package com.resa.smsrelay

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat

class MainActivity : AppCompatActivity() {

    private val smsPermission = Manifest.permission.SEND_SMS
    private val notifPermission = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU)
        Manifest.permission.POST_NOTIFICATIONS else null
    private val requestCode = 1001

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        val permissionsNeeded = buildList {
            if (ContextCompat.checkSelfPermission(this@MainActivity, smsPermission) != PackageManager.PERMISSION_GRANTED) {
                add(smsPermission)
            }
            notifPermission?.let {
                if (ContextCompat.checkSelfPermission(this@MainActivity, it) != PackageManager.PERMISSION_GRANTED) {
                    add(it)
                }
            }
        }

        if (permissionsNeeded.isNotEmpty()) {
            ActivityCompat.requestPermissions(this, permissionsNeeded.toTypedArray(), requestCode)
        } else {
            startRelayService()
        }
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == this.requestCode) {
            val smsDenied = grantResults.getOrNull(permissions.indexOf(smsPermission)) == PackageManager.PERMISSION_DENIED
            val statusView = findViewById<TextView>(R.id.status_text)
            if (smsDenied) {
                statusView.text = getString(R.string.permission_denied)
            } else {
                startRelayService()
            }
        }
    }

    private fun startRelayService() {
        val intent = Intent(this, SmsRelayService::class.java)
        ContextCompat.startForegroundService(this, intent)
        val statusView = findViewById<TextView>(R.id.status_text)
        statusView.text = getString(R.string.service_running)
    }
}
