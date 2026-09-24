package com.okali.orion.playback

import org.junit.Assert.assertFalse
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class OrionDownloadOriginTrustTest {
  private val root = "http://198.51.100.10"
  private val providerMedia = "http://203.0.113.10"
  private val observedMedia = "http://192.0.2.10"
  private val unknown = "http://198.51.100.20"
  private val approved = setOf(root, providerMedia)
  private val observed = setOf("$observedMedia/seen.ts")

  @Test fun sameOriginMediaIsTrusted() {
    assertTrue(OrionDownloadRequestContextBroker.trustedDescendantDestination(approved, observed, "$root/child.ts"))
  }

  @Test fun providerManifestApprovedCrossOriginMediaIsTrusted() {
    assertTrue(OrionDownloadRequestContextBroker.trustedDescendantDestination(approved, observed, "$providerMedia/child.ts"))
  }

  @Test fun sessionObservedCrossOriginMediaIsTrusted() {
    assertTrue(OrionDownloadRequestContextBroker.trustedDescendantDestination(approved, observed, "$observedMedia/other.ts"))
  }

  @Test fun unknownPublicCrossOriginMediaIsRejected() {
    assertFalse(OrionDownloadRequestContextBroker.trustedDescendantDestination(approved, observed, "$unknown/child.ts"))
  }

  @Test fun privateAndLocalMediaAreRejectedEvenWhenDeclaredOrObserved() {
    for (origin in listOf("http://127.0.0.1", "http://10.0.0.1", "http://localhost")) {
      assertFalse(OrionDownloadRequestContextBroker.trustedDescendantDestination(approved + origin, observed + "$origin/seen.ts", "$origin/child.ts"))
    }
  }

  @Test fun redirectToUnknownPublicOriginIsRejected() {
    assertFalse(OrionDownloadRequestContextBroker.trustedRedirectDestination(approved, observed, "$unknown/redirect.ts"))
    assertFalse(OrionDownloadRequestContextBroker.trustedRedirectDestination(approved, observed, "$observedMedia/unseen-redirect.ts"))
  }

  @Test fun redirectToPrivateOrLocalOriginIsRejected() {
    for (origin in listOf("http://127.0.0.1", "http://10.0.0.1", "http://localhost")) {
      assertFalse(OrionDownloadRequestContextBroker.trustedRedirectDestination(approved + origin, observed + "$origin/redirect.ts", "$origin/redirect.ts"))
    }
  }

  @Test fun approvedAndExactObservedRedirectsRemainTrusted() {
    assertTrue(OrionDownloadRequestContextBroker.trustedRedirectDestination(approved, observed, "$providerMedia/redirect.ts"))
    assertTrue(OrionDownloadRequestContextBroker.trustedRedirectDestination(approved, observed, "$observedMedia/seen.ts"))
  }

  @Test fun unobservedCrossOriginHeadersDoNotInheritAuthorizationOrCookies() {
    val headers = OrionDownloadRequestContextBroker.safeCrossOriginHeaders(mapOf(
      "Authorization" to "Bearer root-secret",
      "Cookie" to "root-session=secret",
      "Origin" to root,
      "Referer" to "$root/private?token=secret",
      "Accept" to "video/*",
    ))
    assertEquals(mapOf("Referer" to "$root/", "Accept" to "video/*"), headers)
  }

  @Test fun boundJobRetainsOnlyExactSessionObservationsAfterPlayerCloses() {
    val exact = "$observedMedia/seen.ts"
    val active = mapOf(exact to "child-only-request-context")
    val bound = active.toMap()
    assertEquals("child-only-request-context", OrionBoundObservationPolicy.selectExact(active, emptyMap(), exact))
    assertEquals("child-only-request-context", OrionBoundObservationPolicy.selectExact(null, bound, exact))
    assertNull(OrionBoundObservationPolicy.selectExact(null, bound, "$observedMedia/unseen.ts"))
    val retainedUrls = OrionBoundObservationPolicy.trustedUrls(null, bound)
    assertTrue(OrionDownloadRequestContextBroker.trustedDescendantDestination(approved, retainedUrls, "$observedMedia/next.ts"))
    assertFalse(OrionDownloadRequestContextBroker.trustedRedirectDestination(approved, retainedUrls, "$observedMedia/next.ts"))
    assertFalse(OrionDownloadRequestContextBroker.trustedDescendantDestination(approved, retainedUrls, "$unknown/next.ts"))
    assertNull(OrionBoundObservationPolicy.selectExact(null, emptyMap(), exact))
  }
}
