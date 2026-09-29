# 09: Brand naming (Japanese-first)

**Product:** mobile-first trading app on Monad. Gold, stocks, FX and crypto perps from one collateral balance, Face ID passkeys (Mera), and a card that spends uncommitted collateral. See [../08-integrations/README.md](../08-integrations/README.md).
**Brief:** a real Japanese word with a kanji mark (style of "Akashi 証" and "Agari 上がり"). Short, easy to say in English, positive meaning (gold, trade, speed, flow, fortune, one account), and no bad meaning in EN/JA/ZH/KO/ES/PT.
**Checked:** 2026-09-29. All availability results below come from live checks. Raw output is in the session scratchpad (`naming/*.txt`).

## Recommendation

1. **Senryo 千両** is the lead pick. It has the cleanest availability of any candidate (5 of 6 TLDs free, npm free, no token, no fintech app) and a clear money meaning.
2. **Manryo 万両** is the backup. It has the same story at ten times the scale, and it is the only finalist whose GitHub org name is also free.
3. **Kinpaku 金箔** is the card or premium-tier sub-brand ("Senryo Kinpaku card").

## Shortlist

| Name | Kanji | Meaning | Say it | Free TLDs (RDAP 404) | npm | Collisions found | Marketing angle |
|---|---|---|---|---|---|---|---|
| **Senryo** | 千両 | "A thousand ryō (gold coins)". Idiom for great value (千両役者 = star performer). Also a New Year lucky plant with red berries | SEN-ryo | .xyz .app .finance .money .trade (.com taken). Also free: senryo.io, senryo.co, getsenryo.com, senryoapp.com, trysenryo.com | free | GitHub `senryo` taken. Play: Maxim's "Sen-ryo" sushi app (restaurant). CoinGecko: none | "Worth a thousand." / "Every market. One balance. Senryo." |
| **Manryo** | 万両 | "Ten thousand ryō". A lucky plant that pairs with Senryo | MAHN-ryo | .xyz .app .finance .money .trade. Also free: manryo.io, getmanryo.com, manryoapp.com | free | **GitHub org free (404)**. App Store: none. CoinGecko: none | "Ten thousand ways to grow." |
| **Kinpaku** | 金箔 | Gold leaf | KEEN-pah-koo | .xyz .app .finance .money .trade. Also free: kinpakuapp.com | free | GitHub taken. CoinGecko: none. No fintech hits found | "Gold, in your pocket." Works well as the card name |
| **Akinai** | 商い | Trade or business (the act of dealing) | ah-KEE-nai | .finance .money .trade. Also free: akinai.io, getakinai.com | free | Akinai, an online-store builder (App Store PY, Play `page.akinai.app`). Not fintech. GitHub taken | "The art of the trade." |
| **Kogane** | 黄金 | Gold (the native reading of 黄金) | ko-GAH-neh | .finance .money .trade. Also free: kogane.io, getkogane.com, koganeapp.com | free | Kogane Ramen and other small non-finance apps. CoinGecko: none | "Everything turns to gold." |
| **Daikichi** | 大吉 | "Great blessing", the top result on an omikuji fortune slip | dye-KEE-chee | .finance .money .trade. Also free: daikichiapp.com | free | App Store: none. CoinGecko: none. Minor risk: "dai" is pronounced "die" | "Draw your best fortune." |

**Logo mark ideas** (hanko-style seals, like Akashi's 証):
- **Senryo:** a square red seal holding 千, with a small sprig of senryō berries breaking out of the corner.
- **Manryo:** a round seal holding 万, reusing the Senryo family's seal grid.
- **Kinpaku:** 金 stamped in gold foil on a black card. The mark is the card's chip area.
- **Akinai:** 商 in a seal whose frame is an abacus bead row.
- **Kogane:** a koban-shaped oval (Edo gold coin) with 黄 debossed.
- **Daikichi:** 大吉 inside a folded omikuji slip. The app icon "unfolds" on launch.

## Method and raw results

- **Domains.** `curl -sL -o /dev/null -w "%{http_code}" https://rdap.org/domain/<name>.<tld>`. A 404 means the registry RDAP says "not found", which is likely available. A 200 means registered. `whois` to the registry could not be used from this machine: `whois.nic.google` did not resolve, and the other registry servers returned nothing or timed out. For example, `rdap.org/domain/kawase.app` returned `{"errorCode":404,"description":["kawase.app not found"]}`.
- **npm.** `registry.npmjs.org/<name>`. A 404 means free.
- **GitHub.** Checked with `github.com/<name>` (the API hit its rate limit). A 404 means free.
- **App Store.** `itunes.apple.com/search?entity=software` (exact name matches).
- **Play Store and trademark.** Firecrawl search.
- **Tokens.** CoinGecko `/api/v3/search`.

Finalist raw results:

```
senryo   com:200 xyz:404 app:404 finance:404 money:404 trade:404 npm:404 gh:200
manryo   com:200 xyz:404 app:404 finance:404 money:404 trade:404 npm:404 gh:404
kinpaku  com:200 xyz:404 app:404 finance:404 money:404 trade:404 npm:404 gh:200
akinai   com:200 xyz:200 app:200 finance:404 money:404 trade:404 npm:404 gh:200
kogane   com:200 xyz:200 app:200 finance:404 money:404 trade:404 npm:404 gh:200
daikichi com:200 xyz:200 app:200 finance:404 money:404 trade:404 npm:404 gh:200
modifiers (404 = free): getsenryo.com senryo.co senryo.io senryoapp.com trysenryo.com
  manryoapp.com getmanryo.com manryo.io getakinai.com akinai.io koganeapp.com getkogane.com
  kogane.io daikichiapp.com kinpakuapp.com ; akinaiapp.com = 200 (taken)
```

Every bare .com checked was taken. Plan on a modifier .com (for example getsenryo.com) or a TLD like senryo.app or senryo.money.

## Candidate longlist (48) and filter

| # | Name | Kanji | Literal meaning | Fit | Result |
|---|---|---|---|---|---|
| 1 | Senryo | 千両 | 1,000 ryō gold coins | fortune, gold | **Shortlist** |
| 2 | Manryo | 万両 | 10,000 ryō | fortune | **Shortlist** |
| 3 | Kinpaku | 金箔 | gold leaf | gold, card | **Shortlist** |
| 4 | Akinai | 商い | trade, business | trading | **Shortlist** |
| 5 | Kogane | 黄金 | gold | gold | **Shortlist** |
| 6 | Daikichi | 大吉 | great blessing | fortune | **Shortlist** |
| 7 | Koban | 小判 | Edo gold coin | gold | Cut: KOBAN token (Coinbase, Binance price pages), "koban" Finance app on the App Store; .xyz and .app taken |
| 8 | Kawase | 為替 | foreign exchange | FX | Cut: Kawase is an existing FX/CFD broker (dailyforex review, Crown Agents Bank) |
| 9 | Dojima | 堂島 | Dojima rice exchange, the first futures market | perps story | Cut: Dojima Network token (CoinMarketCap) |
| 10 | Kinza | 金座 | Edo gold mint | gold | Cut: Kinza Finance, a DeFi lender on BNB; .finance taken |
| 11 | Tenbin | 天秤 | balance scale | one balance | Cut: Tenbin Gold (TGLD) and Tenbin FX tokens on CoinGecko |
| 12 | Soroban | 算盤 | abacus | money | Cut: Stellar's Soroban smart-contract platform |
| 13 | Maneki | 招き | beckoning (lucky cat) | fortune | Cut: three MANEKI tokens on CoinGecko |
| 14 | Kaname | 要 | keystone | one account | Cut: Kaname Capital (hedge fund); npm taken |
| 15 | Kinzan | 金山 | gold mountain | gold | Cut: 金山 = Kingsoft in Chinese |
| 16 | Kinsen | 金銭 | money | money | Cut: .xyz taken; weaker sound |
| 17 | Kinryu | 金龍 | golden dragon | gold | Cut: .xyz taken; very common restaurant name |
| 18 | Ryogae | 両替 | money exchange | FX | Cut: hard to say ("ryo-ga-eh") |
| 19 | Koza | 口座 | bank account | one account | Cut: Koza Altın (Turkish gold miner), many apps; .xyz and .app taken |
| 20 | Ippon | 一本 | full point (judo) | winning | Cut: 8+ judo and game apps; .xyz and .app taken |
| 21 | Hayate | 疾風 | gale | speed | Cut: npm, .xyz and .app taken; game app |
| 22 | Nagare | 流れ | flow | flow | Cut: npm, .xyz and .app taken; IPTV app |
| 23 | Inazuma | 稲妻 | lightning | speed | Cut: Genshin/Inazuma Eleven; npm and .app taken |
| 24 | Kiseki | 奇跡/軌跡 | miracle, trajectory | price path | Cut: npm, .xyz and .app taken |
| 25 | Masu | 増す | to increase | growth | Cut: .xyz and .app taken; reads as a grammar suffix |
| 26 | Takara | 宝 | treasure | wealth | Cut: Takara Tomy and Takara Bio; .money taken |
| 27 | Okane | お金 | money | money | Cut: 5 of 6 TLDs and npm taken |
| 28 | Zeni | 銭 | coin | money | Cut: 5 of 6 TLDs and npm taken |
| 29 | Saifu | 財布 | wallet | card | Cut: npm, .xyz and .app taken |
| 30 | Kinka | 金貨 | gold coin | gold | Cut: npm, .xyz and .app taken |
| 31 | Oban | 大判 | large gold coin | gold | Cut: npm, .xyz and .app taken |
| 32 | Kagi | 鍵 | key | Face ID | Cut: npm and .money taken |
| 33 | Hanko | 判子 | personal seal | passkey sign | Cut: npm and .app taken; existing e-sign brands |
| 34 | Tegata | 手形 | bill of exchange | finance | Cut: npm taken; weak sound |
| 35 | Kizuna | 絆 | bond | trust | Cut: npm and .money taken; off-theme |
| 36 | Kinsei | 金星 | Venus, gold star | gold | Cut: .finance taken |
| 37 | Kanemochi | 金持ち | rich person | wealth | Cut: long; brags |
| 38 | Hitotsu | 一つ | one | one account | Cut: existing app; flat meaning |
| 39 | Ichiza | 一座 | one troupe | one account | Cut: .xyz taken; obscure |
| 40 | Isshun | 一瞬 | an instant | speed | Cut: "shun" in English |
| 41 | Kinchaku | 巾着 | drawstring purse | wallet | Cut: hard to spell |
| 42 | Suehiro | 末広 | widening fan (prosperity) | growth | Cut: hard to say; .trade taken |
| 43 | Choja | 長者 | millionaire | wealth | Cut: close to "chocha" (vulgar in some Spanish dialects) |
| 44 | Ogon | 黄金 | gold (on reading) | gold | Cut: Kogane reads better |
| 45 | Kinun | 金運 | money luck | fortune | Cut: "kin-un" is awkward in English |
| 46 | Fuku | 福 | fortune | fortune | Cut: English profanity |
| 47 | Kinko | 金庫 | safe, vault | vault | Cut: "kinky" |
| 48 | Ichi / Soba / Shun | 一 / 相場 / 瞬 | one / market price / instant | various | Cut: "itchy" / noodles / "shun" |

Korean and Chinese backups were not needed, because six Japanese finalists passed. They were not checked, so none is claimed to be available.
