package com.okali.orion.playback

/** JSON persistence may reparse a small Long as Int; media coordinates are still exact integers. */
internal object OrionFreshRebindNumberPolicy {
  fun same(left: Any?, right: Any?): Boolean {
    if (left == null || right == null) return left == null && right == null
    if (left !is Byte && left !is Short && left !is Int && left !is Long) return false
    if (right !is Byte && right !is Short && right !is Int && right !is Long) return false
    return (left as Number).toLong() == (right as Number).toLong()
  }
}
