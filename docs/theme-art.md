# Game default themes

The **Game default / 게임 기본** preference follows the selected game. Minecraft uses a mint background; Stardew Valley uses a cream background. Each pastel canvas has a static local game screenshot at 6% opacity. Other games and the all-games view retain the photographic magenta theme. Color themes remain available in settings.

The new preference is saved as `modfinder-theme`. Existing non-default color choices migrate from `modfinder-accent`. The old automatically saved magenta default becomes Game default; magenta can still be explicitly selected and saved with the new key.

## Original artwork sources

Retrieved 2026-10-28. These are original game/publisher assets, not crops of the generated design references. They are bundled locally to avoid third-party requests during use. All game artwork remains owned by the respective rights holders.

| Local asset in `src/web/public/theme-art/` | Publisher source | Preparation |
| --- | --- | --- |
| `minecraft-steve.webp` | [Minecraft: What is Minecraft?](https://www.minecraft.net/en-us/about-minecraft), [original PNG](https://www.minecraft.net/content/dam/minecraftnet/games/minecraft/game-characters/MC-About_Key-Art_Gather_Resources_600x800.png) | Transparent padding trimmed; lossless WebP. © Mojang / Microsoft. |
| `minecraft-alex.webp` | [Minecraft: What is Minecraft?](https://www.minecraft.net/en-us/about-minecraft), [original PNG](https://www.minecraft.net/content/dam/minecraftnet/games/minecraft/game-characters/MC-About_Key-Art_Build_Amazing_Things_600x800.png) | Alex cropped from the upper-left at (60, 72)–(255, 305); lossless WebP. © Mojang / Microsoft. |
| `minecraft-adventurer.webp` | [Minecraft: Tips for Beginners](https://www.minecraft.net/en-us/minecraft-tips-for-beginners), [original PNG](https://www.minecraft.net/content/dam/minecraftnet/games/minecraft/key-art/Tips-for-Beginners_Media-Block-B_Pals-1_704x326_2x.png) | Leftmost character cropped at (0, 110)–(334, 652), padding trimmed; lossless WebP. © Mojang / Microsoft. |
| `stardew-chicken.webp` | [Stardew Valley official site](https://www.stardewvalley.net/), [original PNG](https://www.stardewvalley.net/wp-content/uploads/2017/12/cropped-chickenfavicon-192x192.png) | Lossless WebP. © ConcernedApe. |
| `stardew-junimo.webp` | [Official Stardew Valley Wiki: Junimos](https://wiki.stardewvalley.net/Junimos), [original GIF](https://wiki.stardewvalley.net/mediawiki/images/5/57/Junimo.gif) | First frame, transparent padding trimmed; static lossless WebP. © ConcernedApe. |
| `stardew-cat.webp` | [Official Stardew Valley Wiki: Pet](https://wiki.stardewvalley.net/Pet), [original PNG](https://wiki.stardewvalley.net/mediawiki/images/1/1e/Cat_1.png) | Transparent padding trimmed; lossless WebP. © ConcernedApe. |

Steve and the Junimo are the respective central representatives above the home search field. Companion characters sit below its left and right edges. The field is a higher sibling paint layer, keeping its rim and controls in front of every character. Characters are decorative, hidden from assistive technology, and ignore pointer events. The results layout uses the same palette with a compact search field.

The logo has separate pastel gradient tokens; control and text accents stay darker for legibility. Option cards are transparent, with a translucent tint only when selected. Masked gradient rims and inset highlights preserve the liquid glass border treatment. These light themes do not mount the WebGL renderer or particle effects. Existing screenshot sources remain recorded in `src/shared/data/backgrounds.json`.
