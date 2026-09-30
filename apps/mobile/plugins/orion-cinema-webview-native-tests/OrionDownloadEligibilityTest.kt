package com.okali.orion.playback

import org.junit.After
import org.junit.Assert.*
import org.junit.Test

class OrionDownloadEligibilityTest {
  @Suppress("UNCHECKED_CAST")
  private fun contexts(): MutableMap<String, CapturedContext> =
    OrionDownloadRequestContextBroker.javaClass.getDeclaredField("contexts").let {
      it.isAccessible = true
      it.get(OrionDownloadRequestContextBroker) as MutableMap<String, CapturedContext>
    }

  @Suppress("UNCHECKED_CAST")
  private fun sessions(): MutableMap<String, OrionDownloadCaptureSession> =
    OrionDownloadRequestContextBroker.javaClass.getDeclaredField("captureSessions").let {
      it.isAccessible = true
      it.get(OrionDownloadRequestContextBroker) as MutableMap<String, OrionDownloadCaptureSession>
    }

  // Substitute only the completed network preflight; exercise the real broker/job bind gate.
  private fun ready(source: String, permission: Any?, sessionId: String = "session-1"): CapturedContext {
    OrionDownloadRequestContextBroker.setCaptureSession(source, sessionId, true, permission)
    val policy = sessions()[sessionId]!!
    return CapturedContext(
      candidateId = "candidate-$source", requestContextId = "opaque-$source", sourceId = source, sessionId = sessionId,
      providerClass = "candidate", rawUrl = "https://example.com/fixture.m3u8", requestHeaders = emptyMap(), cookieHeader = null,
      observedManifestKind = "hls", expiry = "stable", expiresAt = null, capturedAt = System.currentTimeMillis(),
      allowedOrigins = emptySet(), preflightState = "ready", resolvedKind = "hls", requestContextReady = true,
      downloadAllowed = policy.downloadAllowed, captureSession = policy,
    ).also { contexts()[it.candidateId] = it }
  }

  @After fun cleanup() {
    listOf("vixsrc", "vidsrc", "vidsrc-ir", "vidlink", "cinesrc", "vidnest", "unknown").forEach {
      OrionDownloadTransferRuntime.release("job-$it")
    }
    contexts().clear()
    sessions().clear()
  }

  @Test fun diagnosticReadyCannotBindOrEnterNativeJobAdmission() {
    for (source in listOf("vidsrc-ir", "vidlink", "cinesrc", "vidnest")) {
      val context = ready(source, false)
      assertTrue(context.captureSession!!.canObserve(source, context.sessionId))
      assertEquals("ready", context.preflightState)
      assertFalse(context.canDownload())
      assertNull(OrionDownloadRequestContextBroker.bindRequestContext(context.candidateId, "job-$source"))
      assertNull(OrionDownloadTransferRuntime.bind(context.candidateId, "job-$source"))
    }
  }

  @Test fun missingInvalidOrUnregisteredPermissionFailsClosed() {
    for (permission in listOf(null, false, "true", 1)) {
      val context = ready("vidsrc-ir", permission)
      assertFalse(context.canDownload())
      assertNull(OrionDownloadRequestContextBroker.bindRequestContext(context.candidateId, "job-vidsrc-ir"))
    }
    val unknown = ready("unknown", false).copy(downloadAllowed = true, captureSession = null)
    contexts()[unknown.candidateId] = unknown
    assertNull(OrionDownloadRequestContextBroker.bindRequestContext(unknown.candidateId, "job-unknown"))
  }

  @Test fun acceptedControlsAndVidSrcIrQualificationBindOnlyTheirOwnReadyContext() {
    for (source in listOf("vixsrc", "vidsrc", "vidsrc-ir")) {
      val context = ready(source, true)
      assertNotNull(OrionDownloadRequestContextBroker.bindRequestContext(context.candidateId, "job-$source"))
      assertNull(OrionDownloadRequestContextBroker.bindRequestContext(context.candidateId, "another-job"))
    }
  }

  @Test fun sourceAndSessionMismatchCannotBorrowAcceptedPermission() {
    val accepted = ready("vixsrc", true)
    for (mismatch in listOf(accepted.copy(sourceId = "vidsrc-ir"), accepted.copy(sessionId = "stale-session"))) {
      contexts()[accepted.candidateId] = mismatch
      assertFalse(mismatch.canDownload())
      assertNull(OrionDownloadRequestContextBroker.bindRequestContext(mismatch.candidateId, "job-vixsrc"))
    }
  }

  @Test fun replacedSessionRevokesStaleCallbacksAndUnboundAdmission() {
    val old = ready("vixsrc", true)
    OrionDownloadRequestContextBroker.setCaptureSession("vidsrc-ir", old.sessionId, true, false)
    assertFalse(old.captureSession!!.canObserve("vixsrc", old.sessionId))
    assertNull(OrionDownloadRequestContextBroker.bindRequestContext(old.candidateId, "job-vixsrc"))
  }

  @Test fun stoppingObservationPreservesValidRetainedAdmissionAndBoundCleanup() {
    val context = ready("vidsrc", true)
    OrionDownloadRequestContextBroker.stopCaptureSession(context.sessionId)
    assertFalse(context.captureSession!!.canObserve("vidsrc", context.sessionId))
    assertNotNull(OrionDownloadRequestContextBroker.bindRequestContext(context.candidateId, "job-vidsrc"))
    OrionDownloadRequestContextBroker.releaseSession(context.sessionId)
    assertTrue(context.sessionReleased)
    assertTrue(context.canDownload())
    OrionDownloadRequestContextBroker.releaseJob("job-vidsrc")
    assertNull(OrionDownloadRequestContextBroker.bindRequestContext(context.candidateId, "job-vidsrc"))
  }

  @Test fun unreadyExpiredAndReleasedContextsCannotBind() {
    val ready = ready("vixsrc", true)
    for (context in listOf(ready.copy(preflightState = "checking"), ready.copy(requestContextReady = false),
      ready.copy(expiresAt = System.currentTimeMillis() - 1))) {
      contexts()[ready.candidateId] = context
      assertNull(OrionDownloadRequestContextBroker.bindRequestContext(context.candidateId, "job-vixsrc"))
    }
    contexts()[ready.candidateId] = ready
    OrionDownloadRequestContextBroker.releaseSession(ready.sessionId)
    assertNull(OrionDownloadRequestContextBroker.bindRequestContext(ready.candidateId, "job-vixsrc"))
  }
}
