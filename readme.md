# New Year Countdown (Multi-Timezone)

A fullscreen dashboard that tracks New Year countdowns across multiple timezones — automatically handling daylight-saving time and IANA zones. When a region reaches midnight on Jan 1, it shows **🎉 Happy New Year!** and plays fireworks.

## Features

* Multi-timezone countdown (IANA + custom zones)
* DST-correct using `Intl` APIs
* "Happy New Year" for the **entire local Jan 1**
* Fireworks celebration (10 minutes)
* Filter modal with search + multi-select
* Option to pin your browser timezone
* Sort by soonest New Year
* Mobile-friendly responsive UI
## Run locally

### Just open the HTML file in your browser — no build tools needed.

```
index.html
```

### Or open this URL

[https://poovai.github.io/MultiTimeZoneNewYearCountdown/](https://poovai.github.io/MultiTimeZoneNewYearCountdown/)

### (Or host it anywhere as a static site.)

##  Adding custom timezones

Use valid IANA identifiers, for example:

```
Asia/Kolkata
America/New_York
Europe/Paris
Australia/Sydney
```

## Tech

* Vanilla JavaScript
* Intl Date APIs (DST-safe)
* HTML + CSS (no frameworks)
