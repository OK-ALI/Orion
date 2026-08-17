package com.okali.orion.cloud

import android.accounts.Account
import android.app.Activity
import android.content.Intent
import android.content.IntentSender
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.BaseActivityEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.google.android.gms.auth.api.identity.AuthorizationClient
import com.google.android.gms.auth.api.identity.AuthorizationRequest
import com.google.android.gms.auth.api.identity.AuthorizationResult
import com.google.android.gms.auth.api.identity.ClearTokenRequest
import com.google.android.gms.auth.api.identity.Identity
import com.google.android.gms.auth.api.identity.RevokeAccessRequest
import com.google.android.gms.common.api.Scope

internal object OrionGoogleDriveTokenVault {
  private var accountEmail: String? = null
  private var accessToken: String? = null

  @Synchronized
  fun store(email: String, token: String) {
    accountEmail = email
    accessToken = token
  }

  @Synchronized
  fun tokenFor(email: String): String? =
    if (accountEmail == email) accessToken else null

  @Synchronized
  fun clear(): String? {
    val token = accessToken
    accountEmail = null
    accessToken = null
    return token
  }
}

class OrionGoogleDriveAuthorizationModule(
  private val reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {
  companion object {
    internal const val DRIVE_APPDATA_SCOPE = "https://www.googleapis.com/auth/drive.appdata"
    private const val GOOGLE_ACCOUNT_TYPE = "com.google"
    private const val REQUEST_AUTHORIZE_DRIVE = 4812
  }

  private var pendingPromise: Promise? = null
  private var pendingClient: AuthorizationClient? = null
  private var pendingAccountEmail: String? = null

  private val activityListener = object : BaseActivityEventListener() {
    override fun onActivityResult(
      activity: Activity,
      requestCode: Int,
      resultCode: Int,
      data: Intent?,
    ) {
      if (requestCode != REQUEST_AUTHORIZE_DRIVE) return

      if (resultCode != Activity.RESULT_OK || data == null) {
        rejectPending("GOOGLE_DRIVE_AUTH_CANCELLED", "Google Drive access was cancelled.")
        return
      }

      val client = pendingClient
      if (client == null) {
        rejectPending("GOOGLE_DRIVE_AUTH_INTERRUPTED", "Google Drive access could not finish.")
        return
      }

      try {
        resolveAuthorizationResult(client.getAuthorizationResultFromIntent(data))
      } catch (_: Throwable) {
        rejectPending("GOOGLE_DRIVE_AUTH_FAILED", "Google Drive access could not finish.")
      }
    }
  }

  init {
    reactContext.addActivityEventListener(activityListener)
  }

  override fun getName(): String = "OrionGoogleDriveAuthorization"

  @ReactMethod
  fun checkAppDataAuthorization(accountEmail: String, promise: Promise) {
    val email = accountEmail.trim()
    if (email.isEmpty()) {
      promise.reject("GOOGLE_DRIVE_ACCOUNT_MISSING", "A connected Google account is required to check Drive access.")
      return
    }
    if (pendingPromise != null) {
      promise.reject("GOOGLE_DRIVE_AUTH_BUSY", "A Google Drive access request is already in progress.")
      return
    }

    val request = AuthorizationRequest.builder()
      .setAccount(Account(email, GOOGLE_ACCOUNT_TYPE))
      .setRequestedScopes(listOf(Scope(DRIVE_APPDATA_SCOPE)))
      .build()

    Identity.getAuthorizationClient(reactContext)
      .authorize(request)
      .addOnSuccessListener { result ->
        val grantedScopes = result.grantedScopes ?: emptyList()
        val token = result.accessToken?.trim()
        val alreadyGranted =
          !result.hasResolution() &&
            grantedScopes.contains(DRIVE_APPDATA_SCOPE) &&
            !token.isNullOrEmpty()

        if (alreadyGranted) {
          // Reacquire a fresh native-only token after process restart without
          // launching Google consent UI or persisting OAuth credentials.
          OrionGoogleDriveTokenVault.store(email, token!!)
        }

        val scopes = Arguments.createArray().apply {
          grantedScopes.forEach { scope -> pushString(scope) }
        }
        val response = Arguments.createMap().apply {
          putBoolean("authorized", alreadyGranted)
          putBoolean("interactionRequired", result.hasResolution())
          putString("accountEmail", email)
          putString("scope", DRIVE_APPDATA_SCOPE)
          putArray("grantedScopes", scopes)
        }
        promise.resolve(response)
      }
      .addOnFailureListener {
        promise.reject("GOOGLE_DRIVE_AUTH_CHECK_FAILED", "Google Drive access could not be checked.")
      }
  }

  @ReactMethod
  fun authorizeAppData(accountEmail: String, promise: Promise) {
    val email = accountEmail.trim()
    if (email.isEmpty()) {
      promise.reject("GOOGLE_DRIVE_ACCOUNT_MISSING", "A connected Google account is required for Drive access.")
      return
    }
    if (pendingPromise != null) {
      promise.reject("GOOGLE_DRIVE_AUTH_BUSY", "A Google Drive access request is already in progress.")
      return
    }

    val activity = reactContext.currentActivity
    if (activity == null) {
      promise.reject("GOOGLE_DRIVE_ACTIVITY_UNAVAILABLE", "Google Drive access is not available right now.")
      return
    }

    val authorizationClient = Identity.getAuthorizationClient(activity)
    val request = AuthorizationRequest.builder()
      .setAccount(Account(email, GOOGLE_ACCOUNT_TYPE))
      .setRequestedScopes(listOf(Scope(DRIVE_APPDATA_SCOPE)))
      .build()

    pendingPromise = promise
    pendingClient = authorizationClient
    pendingAccountEmail = email

    authorizationClient.authorize(request)
      .addOnSuccessListener { result ->
        if (result.hasResolution()) {
          val pendingIntent = result.pendingIntent
          if (pendingIntent == null) {
            rejectPending("GOOGLE_DRIVE_AUTH_FAILED", "Google Drive access could not open the consent screen.")
            return@addOnSuccessListener
          }
          try {
            activity.startIntentSenderForResult(
              pendingIntent.intentSender,
              REQUEST_AUTHORIZE_DRIVE,
              null,
              0,
              0,
              0,
            )
          } catch (_: IntentSender.SendIntentException) {
            rejectPending("GOOGLE_DRIVE_AUTH_FAILED", "Google Drive access could not open the consent screen.")
          }
        } else {
          resolveAuthorizationResult(result)
        }
      }
      .addOnFailureListener {
        rejectPending("GOOGLE_DRIVE_AUTH_FAILED", "Google Drive access could not be authorized.")
      }
  }

  @ReactMethod
  fun revokeAppData(accountEmail: String, promise: Promise) {
    val email = accountEmail.trim()
    if (email.isEmpty()) {
      promise.reject("GOOGLE_DRIVE_ACCOUNT_MISSING", "A connected Google account is required to remove Drive access.")
      return
    }
    if (pendingPromise != null) {
      promise.reject("GOOGLE_DRIVE_AUTH_BUSY", "A Google Drive access request is already in progress.")
      return
    }

    val request = RevokeAccessRequest.builder()
      .setAccount(Account(email, GOOGLE_ACCOUNT_TYPE))
      .setScopes(listOf(Scope(DRIVE_APPDATA_SCOPE)))
      .build()

    Identity.getAuthorizationClient(reactContext)
      .revokeAccess(request)
      .addOnSuccessListener {
        // Clear the native-only token only after Google confirms that the
        // app-data grant was revoked for this account.
        OrionGoogleDriveTokenVault.clear()
        promise.resolve(true)
      }
      .addOnFailureListener {
        // Keep the native token available if revocation fails so Orion does
        // not falsely report that access was removed.
        promise.reject("GOOGLE_DRIVE_REVOKE_FAILED", "Google Drive access could not be removed.")
      }
  }

  @ReactMethod
  fun clearAuthorizationCache(promise: Promise) {
    val token = OrionGoogleDriveTokenVault.clear()
    if (token.isNullOrBlank()) {
      promise.resolve(true)
      return
    }

    val request = ClearTokenRequest.builder()
      .setToken(token)
      .build()
    Identity.getAuthorizationClient(reactContext)
      .clearToken(request)
      .addOnSuccessListener { promise.resolve(true) }
      .addOnFailureListener {
        // Orion has already removed its native in-memory copy. Google Play
        // services cache cleanup is best-effort on account disconnect.
        promise.resolve(false)
      }
  }

  private fun resolveAuthorizationResult(result: AuthorizationResult) {
    val promise = pendingPromise ?: return
    val email = pendingAccountEmail
    val grantedScopes = result.grantedScopes ?: emptyList()
    val token = result.accessToken?.trim()

    if (email.isNullOrEmpty() || !grantedScopes.contains(DRIVE_APPDATA_SCOPE) || token.isNullOrEmpty()) {
      rejectPending("GOOGLE_DRIVE_SCOPE_MISSING", "Google Drive did not grant Orion app-data access.")
      return
    }

    // The OAuth access token stays native-only and in memory. It is never
    // returned to JavaScript and is never persisted by this bridge.
    OrionGoogleDriveTokenVault.store(email, token)

    val scopes = Arguments.createArray().apply {
      grantedScopes.forEach { scope -> pushString(scope) }
    }
    val response = Arguments.createMap().apply {
      putBoolean("authorized", true)
      putString("accountEmail", email)
      putString("scope", DRIVE_APPDATA_SCOPE)
      putArray("grantedScopes", scopes)
    }
    clearPending()
    promise.resolve(response)
  }

  private fun rejectPending(code: String, message: String) {
    val promise = pendingPromise
    clearPending()
    promise?.reject(code, message)
  }

  private fun clearPending() {
    pendingPromise = null
    pendingClient = null
    pendingAccountEmail = null
  }

  override fun invalidate() {
    reactContext.removeActivityEventListener(activityListener)
    rejectPending("GOOGLE_DRIVE_AUTH_INTERRUPTED", "Google Drive access was interrupted.")
    OrionGoogleDriveTokenVault.clear()
    super.invalidate()
  }
}
