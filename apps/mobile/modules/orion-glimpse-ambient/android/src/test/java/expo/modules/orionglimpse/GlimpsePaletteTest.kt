package expo.modules.orionglimpse
import org.junit.Assert.*
import org.junit.Test
class GlimpsePaletteTest {
  @Test fun blackBarsAndWhiteChromeDoNotBecomeVideoColors() {
    assertEquals(listOf("#ff0000", "#0000ff"), GlimpsePalette.colors(IntArray(200) { 0xff000000.toInt() } + IntArray(20) { 0xffffffff.toInt() } + IntArray(16) { 0xffff0000.toInt() } + IntArray(10) { 0xff0000ff.toInt() }))
  }
  @Test fun unavailableOrMonochromeFramesNeverFabricatePalette() {
    assertNull(GlimpsePalette.colors(IntArray(576) { 0xff000000.toInt() }))
    assertNull(GlimpsePalette.colors(IntArray(576) { 0xff999999.toInt() }))
  }
  @Test fun successiveVideoColorsProduceDifferentBoundedPalettes() {
    val a=GlimpsePalette.colors(IntArray(576) { 0xff20c040.toInt() })!!
    val b=GlimpsePalette.colors(IntArray(576) { 0xffc02040.toInt() })!!
    assertNotEquals(a,b);assertEquals(2,a.size);assertTrue(a.all { it.matches(Regex("#[0-9a-f]{6}")) })
  }
}
