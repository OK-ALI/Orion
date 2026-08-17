package com.okali.orion.identity

import androidx.credentials.ClearCredentialStateRequest
import androidx.credentials.CredentialManager
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.credentials.exceptions.GetCredentialException
import androidx.credentials.exceptions.NoCredentialException
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import com.google.android.libraries.identity.googleid.GoogleIdTokenParsingException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

class OrionGoogleIdentityModule(
  private val reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {
  private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)

  override fun getName(): String = "OrionGoogleIdentity"

  @ReactMethod
  fun signIn(serverClientId: String, promise: Promise) {
    val clientId = serverClientId.trim()
    if (clientId.isEmpty()) {
      promise.reject("GOOGLE_CLIENT_ID_MISSING", "Google sign-in is not configured for this Orion build.")
      return
    }

    val activity = reactContext.currentActivity
    if (activity == null) {
      promise.reject("GOOGLE_ACTIVITY_UNAVAILABLE", "Google sign-in is not available right now.")
      return
    }

    scope.launch {
      try {
        val credentialManager = CredentialManager.create(reactContext)
        val option = GetSignInWithGoogleOption.Builder(clientId).build()
        val request = GetCredentialRequest.Builder()
          .addCredentialOption(option)
          .build()
        val response = credentialManager.getCredential(
          context = activity,
          request = request,
        )
        val credential = response.credential

        if (
          credential !is CustomCredential
          || credential.type != GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL
        ) {
          promise.reject("GOOGLE_CREDENTIAL_UNSUPPORTED", "Google returned an unsupported credential.")
          return@launch
        }

        val google = GoogleIdTokenCredential.createFrom(credential.data)
        val email = google.email?.trim()
        if (email.isNullOrEmpty()) {
          promise.reject("GOOGLE_PROFILE_INCOMPLETE", "Google did not return an email address.")
          return@launch
        }

        val profile = Arguments.createMap().apply {
          putString("provider", "google")
          putString("accountId", google.uniqueId)
          putString("email", email)
          putString("displayName", google.displayName)
          putString("givenName", google.givenName)
          putString("familyName", google.familyName)
          putString("avatarUrl", google.profilePictureUri?.toString())
        }
        // Deliberately do not expose or persist the Google ID token in JavaScript.
        promise.resolve(profile)
      } catch (_: GetCredentialCancellationException) {
        promise.reject("GOOGLE_SIGN_IN_CANCELLED", "Google sign-in was cancelled.")
      } catch (_: NoCredentialException) {
        promise.reject("GOOGLE_NO_CREDENTIAL", "No Google credential is available on this device.")
      } catch (_: GoogleIdTokenParsingException) {
        promise.reject("GOOGLE_TOKEN_PARSE_FAILED", "Google sign-in returned an unreadable identity credential.")
      } catch (_: GetCredentialException) {
        promise.reject("GOOGLE_SIGN_IN_FAILED", "Google sign-in could not finish.")
      } catch (_: Throwable) {
        promise.reject("GOOGLE_SIGN_IN_FAILED", "Google sign-in could not finish.")
      }
    }
  }

  @ReactMethod
  fun clearCredentialState(promise: Promise) {
    scope.launch {
      try {
        CredentialManager.create(reactContext)
          .clearCredentialState(ClearCredentialStateRequest())
        promise.resolve(true)
      } catch (_: Throwable) {
        promise.reject("GOOGLE_CREDENTIAL_CLEAR_FAILED", "Google credential state could not be cleared.")
      }
    }
  }

  override fun invalidate() {
    scope.cancel()
    super.invalidate()
  }
}