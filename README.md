# Differential Temperature Card

A custom Home Assistant Lovelace card — the companion UI for the [Differential Temperature Control blueprint](https://github.com/scrap-code/ha-blueprint-dtcontrol).

## What it does

Gives you a clean, at-a-glance panel for your differential temperature heating setup:

- **Target temperature slider** — adjusts your `input_number` setpoint directly from the card
- **Room temperature display** — current temperature of the target room, labelled with the entity's friendly name (or a custom label)
- **Fan status** — ON / OFF badge with a live runtime counter
- **ΔT display** — colour-coded temperature differential between source and target room
  - 🟢 ≥ 3 K — actively transferring heat
  - 🟡 0 – 3 K — marginal
  - 🔴 negative — source is cooler than target

All section labels are configurable. The card includes a full **visual editor** — no YAML required after the initial setup.

---

## Requirements

- Home Assistant 2023.x or later
- The [Differential Temperature Control blueprint](https://github.com/scrap-code/ha-blueprint-dtcontrol) installed and at least one automation created from it

---

## Installation

### HACS (recommended)

1. Open **HACS** in your Home Assistant
2. Go to **Frontend**
3. Click the three-dot menu → **Custom repositories**
4. Paste `https://github.com/scrap-code/ha-card-difftemp` and select category **Lovelace**
5. Click **Install**
6. Hard-refresh your browser (`Ctrl + Shift + R`)

### Manual

1. Download `diff-temp-card.js` from the [latest release](https://github.com/scrap-code/ha-card-difftemp/releases/latest)
2. Copy it to `/config/www/diff-temp-card/diff-temp-card.js` on your HA host
3. Go to **Settings → Dashboards → ⋮ → Resources** and add:
   - URL: `/local/diff-temp-card/diff-temp-card.js`
   - Type: JavaScript module
4. Hard-refresh your browser

---

## Configuration

Add the card via the visual editor, or paste this YAML and adjust entity IDs:

```yaml
type: custom:diff-temp-card
name: "Living Room Heat Transfer"
source_sensor: sensor.room_a_temperature
target_sensor: sensor.room_b_temperature
fan_switch: switch.fan
target_entity: input_number.target_temp_b
```

### Options

| Option | Required | Default | Description |
|---|---|---|---|
| `source_sensor` | ✅ | — | Temperature sensor in the warmer source room (Room A) |
| `target_sensor` | ✅ | — | Temperature sensor in the target room (Room B) |
| `fan_switch` | ✅ | — | Switch entity controlling the fan |
| `target_entity` | no | — | `input_number` / `number` entity for the target setpoint — shows a slider when set |
| `name` | no | `Differential Temperature` | Card title |
| `target_label` | no | entity friendly name | Label above the Room B temperature — leave empty to use the entity name |
| `fan_label` | no | `Fan` | Label above the fan status |
| `target_temp_label` | no | `Target Temperature` | Label above the target temperature slider |
| `delta_label` | no | `ΔT` | Label above the differential display |

---

## Related

- [Differential Temperature Control blueprint](https://github.com/scrap-code/ha-blueprint-dtcontrol) — the automation this card was built for
