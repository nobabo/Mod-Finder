package io.modfinder.app.data

import kotlin.math.pow

private val topics = linkedMapOf(
    "magic" to listOf("magic", "spell", "mana", "마법", "주문", "마나"),
    "exploration" to listOf("adventure", "exploration", "dungeon", "worldgen", "탐험", "던전", "유적"),
    "combat" to listOf("combat", "weapon", "boss", "전투", "무기", "보스"),
    "performance" to listOf("optimization", "performance", "fps", "최적화", "성능", "렉"),
    "building" to listOf("building", "decoration", "furniture", "건축", "장식", "가구"),
    "farming" to listOf("farming", "crops", "farm", "농사", "작물", "농장"),
    "technology" to listOf("technology", "automation", "storage", "기술", "자동화", "창고"),
    "visuals" to listOf("shader", "graphics", "texture", "셰이더", "그래픽", "텍스처"),
)
data class Interest(val gameId: String, val topics: List<String>, val query: String, val weight: Int, val at: Long)
private fun topicIds(text: String) = topics.filterValues { terms -> terms.any { normalized(it) in normalized(text) } }.keys.toList()
fun validInterests(events: List<Interest>, now: Long = System.currentTimeMillis()) = events.filter {
    it.query.length <= 200 && it.topics.size <= 8 && it.topics.all(topics::containsKey) && it.weight in listOf(1, 2, 4) && it.at <= now && it.at > now - 90L * 86400000
}.takeLast(200)
fun recordInterest(events: List<Interest>, gameId: String, query: String = "", item: Listing? = null, now: Long = System.currentTimeMillis()): List<Interest> {
    val event = Interest(gameId, topicIds(item?.let { (listOf(it.title, it.summary) + it.tags).joinToString(" ") } ?: query), query.take(200), if (item != null) 4 else if (query.isNotEmpty()) 2 else 1, now)
    val valid = validInterests(events, now)
    val last = valid.lastOrNull()
    if (last != null && now - last.at < 30000 && last.copy(at = now) == event) return valid
    return (valid + event).takeLast(200)
}
private fun strength(event: Interest, now: Long) = event.weight * 0.5.pow((now - event.at).toDouble() / (14 * 86400000))
fun preferredGame(events: List<Interest>, now: Long = System.currentTimeMillis()) = validInterests(events, now).filter { it.gameId != "all" }.groupBy { it.gameId }.maxByOrNull { (_, values) -> values.sumOf { strength(it, now) } }?.key
fun recommendationQueries(events: List<Interest>, gameId: String, now: Long = System.currentTimeMillis()): List<String> {
    val scores = linkedMapOf<String, Double>()
    validInterests(events, now).filter { it.gameId == "all" || it.gameId == gameId }.forEach { event ->
        (listOf(event.query.trim()) + event.topics.map { topics.getValue(it).first() }).filter { it.isNotEmpty() }.distinct().forEach { query -> scores[query] = (scores[query] ?: 0.0) + strength(event, now) }
    }
    return scores.entries.sortedByDescending { it.value }.take(3).map { it.key }
}
fun recommend(groups: List<ResultGroup>, events: List<Interest>, now: Long = System.currentTimeMillis()): List<ResultGroup> {
    val valid = validInterests(events, now)
    fun score(item: Listing): Double {
        val text = normalized((listOf(item.title, item.summary) + item.tags).joinToString(" "))
        val categories = topicIds(text)
        return valid.filter { it.gameId == "all" || it.gameId == item.gameId }.sumOf { event ->
            strength(event, now) * (event.topics.count { it in categories } + if (normalized(event.query).split(Regex("\\s+")).any { it.length > 1 && it in text }) 1 else 0)
        }
    }
    return groups.sortedByDescending { group -> group.listings.maxOfOrNull(::score) ?: 0.0 }
}
