package com.resa.smsrelay

import android.app.Activity
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.os.IBinder
import android.telephony.SmsManager
import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.suspendCancellableCoroutine
import java.io.IOException
import java.time.Instant
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

class SmsRelayService : Service() {

    private val tag = "SmsRelayService"
    private val channelId = "sms_relay_channel"
    private val notificationId = 1
    private val pollIntervalMs = 30_000L

    private val serviceScope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private val apiClient = ApiClient()

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        startForeground(notificationId, buildNotification())
        startPolling()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        super.onDestroy()
        serviceScope.cancel()
    }

    private fun startPolling() {
        serviceScope.launch {
            while (true) {
                try {
                    processJobs()
                } catch (e: Exception) {
                    Log.w(tag, "Poll cycle error: ${e.javaClass.simpleName}")
                }
                delay(pollIntervalMs)
            }
        }
    }

    private suspend fun processJobs() {
        val jobs = apiClient.getPendingJobs()
        val now = Instant.now()

        for (job in jobs) {
            try {
                val scheduledAt = Instant.parse(job.scheduledAt)
                if (scheduledAt.isAfter(now)) continue

                sendSms(job.phone, job.message)
                // Only reached if sendSms completed without exception (modem confirmed)
                apiClient.confirmJob(job.id)
                Log.i(tag, "Job ${job.id} sent and confirmed")
            } catch (e: Exception) {
                Log.w(tag, "Job ${job.id} failed: ${e.javaClass.simpleName} — will retry")
            }
        }
    }

    // Suspends until the modem confirms all SMS parts were accepted (or throws on failure).
    private suspend fun sendSms(phone: String, message: String) = suspendCancellableCoroutine<Unit> { cont ->
        val smsManager = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            getSystemService(SmsManager::class.java)
        } else {
            @Suppress("DEPRECATION")
            SmsManager.getDefault()
        }

        // divideMessage handles both GSM-7 (160 chars) and UCS-2 (70 chars, triggered by accents)
        val parts = smsManager.divideMessage(message)
        val sentAction = "SMS_SENT_${System.nanoTime()}"
        val successCount = AtomicInteger(0)
        val alreadyFailed = AtomicBoolean(false)

        val receiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context, intent: Intent) {
                if (resultCode != Activity.RESULT_OK) {
                    // First failure wins — resume with exception and stop listening
                    if (alreadyFailed.compareAndSet(false, true)) {
                        safeUnregister(this)
                        cont.resumeWithException(
                            IOException("SMS modem error (resultCode=$resultCode)")
                        )
                    }
                } else if (successCount.incrementAndGet() >= parts.size) {
                    // All parts acknowledged by the modem
                    safeUnregister(this)
                    cont.resume(Unit)
                }
            }
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(receiver, IntentFilter(sentAction), RECEIVER_NOT_EXPORTED)
        } else {
            @Suppress("UnspecifiedRegisterReceiverFlag")
            registerReceiver(receiver, IntentFilter(sentAction))
        }

        // One PendingIntent per part (distinct request codes to avoid caching collisions)
        val sentIntents = parts.indices.map { i ->
            PendingIntent.getBroadcast(
                this, i, Intent(sentAction), PendingIntent.FLAG_IMMUTABLE
            )
        }

        try {
            if (parts.size == 1) {
                smsManager.sendTextMessage(phone, null, parts[0], sentIntents[0], null)
            } else {
                smsManager.sendMultipartTextMessage(phone, null, ArrayList(parts), ArrayList(sentIntents), null)
            }
        } catch (e: Exception) {
            safeUnregister(receiver)
            cont.resumeWithException(e)
        }

        cont.invokeOnCancellation { safeUnregister(receiver) }
    }

    private fun safeUnregister(receiver: BroadcastReceiver) {
        try { unregisterReceiver(receiver) } catch (_: Exception) {}
    }

    private fun createNotificationChannel() {
        val channel = NotificationChannel(
            channelId,
            "SMS Relay Service",
            NotificationManager.IMPORTANCE_LOW
        ).apply {
            description = "Keeps the SMS relay service running in the foreground"
        }
        val manager = getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(channel)
    }

    private fun buildNotification(): Notification =
        Notification.Builder(this, channelId)
            .setContentTitle(getString(R.string.notification_title))
            .setContentText(getString(R.string.notification_text))
            .setSmallIcon(android.R.drawable.ic_dialog_email)
            .setOngoing(true)
            .build()
}
