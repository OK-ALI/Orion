package com.okali.orion.playback

import java.util.Base64
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class OrionWrapperSourceLoadTest {
  private val encoded = Base64.getEncoder().encodeToString("<html><iframe></iframe></html>".toByteArray())
  private val prefixes = listOf("data:text/html;charset=utf-8;base64,", "data:text/html;base64,")
  private fun armed(): OrionWrapperSourceLoad = OrionWrapperSourceLoad().also {
    it.stage(OrionWrapperSourceLoad.BASE_URL, encoded)
    assertTrue(it.arm("anilink", "current", listOf("https://anilink.cc", "https://orion.local"), 1000))
  }
  private fun consume(load: OrionWrapperSourceLoad, url: String = prefixes[0] + encoded,
    source: String = "anilink", session: String = "current", main: Boolean = true, now: Long = 1001): Boolean =
    load.consume(source, session, url, main, now)

  @Test fun exactAppHtmlAndStockEmptyPlaceholdersConsumeOnlyOnce() {
    for (prefix in prefixes) for (payload in listOf(encoded, "")) {
      val load = armed()
      assertTrue(consume(load, prefix + payload))
      assertFalse(consume(load, prefix + payload))
    }
  }

  @Test fun arbitraryContentSchemesHeadersAndFragmentsRemainDenied() {
    val load = armed()
    for (url in listOf(prefixes[0] + encoded.reversed(), prefixes[0] + encoded + "#fragment",
      "data:text/html,", "data:text/plain;base64,", "data:text/html;charset=iso-8859-1;base64,",
      "data:text/html;charset=utf-8;base64," + Base64.getEncoder().encodeToString("<script>bad()</script>".toByteArray()),
      "data:text/html;base64,PRIVATE", "https://orion.local/player/", "about:blank", "file:///local", "javascript:alert(1)")) {
      assertFalse(url, consume(load, url))
    }
    assertTrue(consume(load))
  }

  @Test fun staleSourcesSessionsAndSubframesCannotUseThePermit() {
    val load = armed()
    assertFalse(consume(load, source = "aniembed"))
    assertFalse(consume(load, session = "old"))
    assertFalse(consume(load, main = false))
    assertTrue(consume(load))
  }

  @Test fun expiredAndReversedClocksFailClosed() {
    assertFalse(consume(armed(), now = 6001))
    val load = armed()
    assertFalse(consume(load, now = 999))
    assertFalse(consume(load))
    assertTrue(consume(armed(), now = 6000))
  }

  @Test fun explicitWrapperNavigationAndExactBaseAreRequired() {
    for (base in listOf(null, "https://anilink.cc/", "http://orion.local/player/", "https://orion.local/",
      "https://evil.invalid/player/", "https://user@orion.local/player/")) {
      val load = OrionWrapperSourceLoad()
      load.stage(base, encoded)
      assertFalse(load.arm("anilink", "current", listOf("https://orion.local"), 1000))
      assertFalse(consume(load))
    }
    for (origins in listOf(emptyList(), listOf("*"), listOf("https://orion.local/player/"), listOf("https://anilink.cc"))) {
      val load = OrionWrapperSourceLoad()
      load.stage(OrionWrapperSourceLoad.BASE_URL, encoded)
      assertFalse(load.arm("anilink", "current", origins, 1000))
      assertFalse(consume(load))
    }
  }

  @Test fun malformedEmptyAndOversizedSourceCannotArm() {
    for (content in listOf(null, "", "PRIVATE?token", "A".repeat(174765))) {
      val load = OrionWrapperSourceLoad()
      load.stage(OrionWrapperSourceLoad.BASE_URL, content)
      assertFalse(load.arm("anilink", "current", listOf("https://orion.local"), 1000))
    }
    for ((source, session) in listOf("" to "current", "anilink" to "")) {
      val load = OrionWrapperSourceLoad()
      load.stage(OrionWrapperSourceLoad.BASE_URL, encoded)
      assertFalse(load.arm(source, session, listOf("https://orion.local"), 1000))
    }
  }

  @Test fun sourceReplacementAndCleanupRevokeOldCommitAndNeverRearmOnUnrelatedUpdates() {
    val load = armed()
    assertFalse(load.arm("anilink", "current", listOf("https://orion.local"), 1001))
    assertTrue(consume(load))
    assertFalse(load.arm("anilink", "current", listOf("https://orion.local"), 1001))
    val replaced = armed()
    replaced.stage(null, null)
    assertFalse(consume(replaced))
    val disposed = armed()
    disposed.clear()
    assertFalse(consume(disposed))
    val old = armed()
    old.invalidate()
    assertFalse(consume(old))
  }

  @Test fun initialPropOrderingCanStageBeforeManifestWithoutRevivingConsumedSource() {
    val load = OrionWrapperSourceLoad()
    load.stage(OrionWrapperSourceLoad.BASE_URL, encoded)
    load.invalidate()
    assertTrue(load.arm("anilink", "new", listOf("https://orion.local"), 1000))
    assertFalse(consume(load))
    assertTrue(consume(load, session = "new"))
    load.invalidate()
    assertFalse(load.arm("anilink", "other", listOf("https://orion.local"), 1001))
  }
}
