package com.resa.smsrelay

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.IOException

class ApiClient {

    private val client = OkHttpClient()
    private val json = Json { ignoreUnknownKeys = true }
    private val serverUrl = BuildConfig.SERVER_URL
    private val apiSecret = BuildConfig.API_SECRET

    @Throws(IOException::class)
    fun getPendingJobs(): List<SmsJob> {
        val request = Request.Builder()
            .url("$serverUrl/api/v1/sms-jobs")
            .header("Authorization", "Bearer $apiSecret")
            .get()
            .build()

        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) throw IOException("HTTP ${response.code}")
            val body = response.body?.string() ?: return emptyList()
            val root = json.parseToJsonElement(body).jsonObject
            val dataArray = root["data"]?.jsonArray ?: return emptyList()
            return dataArray.map { json.decodeFromJsonElement(SmsJob.serializer(), it) }
        }
    }

    @Throws(IOException::class)
    fun confirmJob(jobId: String): Boolean {
        val request = Request.Builder()
            .url("$serverUrl/api/v1/sms-jobs/$jobId/confirm")
            .header("Authorization", "Bearer $apiSecret")
            .post("".toRequestBody("application/json".toMediaType()))
            .build()

        client.newCall(request).execute().use { response ->
            return response.isSuccessful
        }
    }
}
