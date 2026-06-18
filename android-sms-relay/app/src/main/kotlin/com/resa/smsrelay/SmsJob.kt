package com.resa.smsrelay

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class SmsJob(
    val id: String,
    val type: String,
    val phone: String,
    val message: String,
    @SerialName("scheduledAt") val scheduledAt: String,
)
