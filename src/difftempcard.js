const CARD_VERSION = '1.0.0';

// ── Editor schema ────────────────────────────────────────────────────────────

const SCHEMA = [
  {
    name:     'name',
    label:    'Card Name',
    selector: { text: {} },
  },
  {
    name:     'source_sensor',
    label:    'Source Temperature Sensor (Room A)',
    required: true,
    selector: { entity: { domain: ['sensor', 'input_number'] } },
  },
  {
    name:     'target_sensor',
    label:    'Target Temperature Sensor (Room B)',
    required: true,
    selector: { entity: { domain: ['sensor', 'input_number'] } },
  },
  {
    name:     'fan_switch',
    label:    'Fan Switch',
    required: true,
    selector: { entity: { domain: ['switch'] } },
  },
  {
    name:     'target_label',
    label:    'Room B Label (leave empty to use entity name)',
    required: false,
    selector: { text: {} },
  },
  {
    name:     'fan_label',
    label:    'Fan Label',
    required: false,
    selector: { text: {} },
  },
  {
    name:     'target_temp_label',
    label:    'Target Temperature Label',
    required: false,
    selector: { text: {} },
  },
  {
    name:     'delta_label',
    label:    'ΔT Label',
    required: false,
    selector: { text: {} },
  },
  {
    name:     'target_entity',
    label:    'Target Temperature Entity (optional)',
    required: false,
    selector: { entity: { domain: ['input_number', 'number'] } },
  },
];

// ── Visual config editor ─────────────────────────────────────────────────────

class DiffTempCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = {};
    this._hass   = null;
  }

  setConfig(config) {
    this._config = { ...config };
    this._sync();
  }

  set hass(hass) {
    this._hass = hass;
    this._sync();
  }

  connectedCallback() {
    if (!this.shadowRoot.querySelector('ha-form')) {
      const form = document.createElement('ha-form');
      form.schema       = SCHEMA;
      form.computeLabel = (s) => s.label;
      form.addEventListener('value-changed', (e) => {
        this._config = e.detail.value;
        this.dispatchEvent(new CustomEvent('config-changed', {
          detail:   { config: this._config },
          bubbles:  true,
          composed: true,
        }));
      });
      this.shadowRoot.appendChild(form);
    }
    this._sync();
  }

  _sync() {
    const form = this.shadowRoot.querySelector('ha-form');
    if (!form) return;
    if (this._hass) form.hass = this._hass;
    form.data = this._config;
  }
}

// ── Card ─────────────────────────────────────────────────────────────────────

class DiffTempCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config       = null;
    this._hass         = null;
    this._tickInterval = null;
  }

  connectedCallback() {
    this._tickInterval = setInterval(() => this._updateFanDuration(), 10_000);
  }

  disconnectedCallback() {
    clearInterval(this._tickInterval);
  }

  static getConfigElement() {
    return document.createElement('diff-temp-card-editor');
  }

  static getStubConfig() {
    return {
      source_sensor: 'sensor.room_a_temperature',
      target_sensor: 'sensor.room_b_temperature',
      fan_switch:    'switch.fan',
      target_entity: 'input_number.target_temp_b',
    };
  }

  setConfig(config) {
    if (!config.source_sensor) throw new Error('diff-temp-card: source_sensor required');
    if (!config.target_sensor) throw new Error('diff-temp-card: target_sensor required');
    if (!config.fan_switch)    throw new Error('diff-temp-card: fan_switch required');
    this._config = {
      name:          config.name          ?? 'Differential Temperature',
      source_sensor: config.source_sensor,
      target_sensor: config.target_sensor,
      fan_switch:    config.fan_switch,
      target_entity: config.target_entity ?? null,
      target_label:      config.target_label      ?? null,
      fan_label:         config.fan_label         ?? 'Fan',
      target_temp_label: config.target_temp_label ?? 'Target Temperature',
      delta_label:       config.delta_label       ?? 'ΔT',
    };
    this._buildDOM();
  }

  set hass(hass) {
    this._hass = hass;
    this._updateValues();
  }

  // ── DOM construction (called once per setConfig) ──────────────────────────

  _buildDOM() {
    const { name, target_entity } = this._config;

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }
        ha-card { padding: 0; }

        .card-header {
          padding: 16px 16px 0;
          font-size: 1.1em;
          font-weight: 600;
          color: var(--ha-card-header-color, var(--primary-text-color));
        }

        .content { padding: 12px 16px 16px; }

        .label {
          font-size: 0.78em;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: var(--secondary-text-color);
          margin-bottom: 4px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .value {
          font-size: 1.5em;
          font-weight: 500;
          color: var(--primary-text-color);
        }
        .unit {
          font-size: 0.7em;
          color: var(--secondary-text-color);
          margin-left: 2px;
        }

        /* Slider */
        .section { margin-bottom: 14px; }
        .slider-row {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        input[type=range] {
          flex: 1;
          height: 4px;
          accent-color: var(--primary-color, #03A9F4);
          cursor: pointer;
        }
        .slider-readout {
          min-width: 52px;
          text-align: right;
          font-size: 1em;
          font-weight: 600;
          color: var(--primary-text-color);
        }

        /* Status row */
        .status-row {
          display: flex;
          gap: 8px;
          align-items: flex-start;
        }
        .status-cell {
          flex: 1;
          min-width: 0;
        }

        /* Fan badge */
        .fan-badge {
          display: inline-block;
          padding: 3px 10px;
          border-radius: 12px;
          font-size: 0.82em;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .fan-badge.on  { background: var(--success-color, #4CAF50); color: #fff; }
        .fan-badge.off { background: var(--disabled-color, #9E9E9E); color: #fff; }
        .fan-row {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
        }
        .fan-duration {
          font-size: 0.78em;
          color: var(--secondary-text-color);
        }

        /* Delta */
        .delta-value { font-size: 1.5em; font-weight: 700; }
        .delta-row { display: flex; align-items: baseline; gap: 3px; }
        .pos { color: var(--success-color,  #4CAF50); }
        .mid { color: var(--warning-color,  #FF9800); }
        .neg { color: var(--error-color,    #F44336); }

        hr { border: none; border-top: 1px solid var(--divider-color, rgba(0,0,0,.12)); margin: 10px 0; }
      </style>

      <ha-card>
        <div class="card-header">${name}</div>
        <div class="content">

          ${target_entity ? `
          <div class="section">
            <div class="label">${this._config.target_temp_label}</div>
            <div class="slider-row">
              <input type="range" id="target-slider">
              <span class="slider-readout"><span id="slider-display">--</span> °C</span>
            </div>
          </div>
          <hr>
          ` : ''}

          <div class="status-row">
            <div class="status-cell">
              <div class="label" id="target-label">Room B</div>
              <div class="value"><span id="target-temp">--</span><span class="unit">°C</span></div>
            </div>
            <div class="status-cell">
              <div class="label">${this._config.fan_label}</div>
              <div class="fan-row">
                <span class="fan-badge off" id="fan-badge">OFF</span>
                <span class="fan-duration" id="fan-duration"></span>
              </div>
            </div>
            <div class="status-cell">
              <div class="label">${this._config.delta_label}</div>
              <div class="delta-row">
                <span class="delta-value mid" id="delta-value">--</span>
                <span class="unit">K</span>
              </div>
            </div>
          </div>

        </div>
      </ha-card>
    `;

    if (target_entity) {
      const slider  = this.shadowRoot.getElementById('target-slider');
      const display = this.shadowRoot.getElementById('slider-display');

      slider.addEventListener('input', (e) => {
        display.textContent = parseFloat(e.target.value).toFixed(1);
      });
      slider.addEventListener('change', (e) => {
        this._hass?.callService('input_number', 'set_value', {
          entity_id: this._config.target_entity,
          value:     parseFloat(e.target.value),
        });
      });
    }
  }

  // ── Value updates (called on every hass change) ───────────────────────────

  _updateValues() {
    if (!this._hass || !this._config) return;
    const root = this.shadowRoot;
    if (!root.getElementById('target-temp')) return;

    const { source_sensor, target_sensor, fan_switch, target_entity } = this._config;
    const srcState = this._hass.states[source_sensor];
    const tgtState = this._hass.states[target_sensor];
    const fanState = this._hass.states[fan_switch];
    const numState = target_entity ? this._hass.states[target_entity] : null;

    const srcTemp = srcState ? parseFloat(srcState.state) : NaN;
    const tgtTemp = tgtState ? parseFloat(tgtState.state) : NaN;

    // Custom label, or fall back to entity friendly name
    root.getElementById('target-label').textContent =
      this._config.target_label || tgtState?.attributes?.friendly_name || target_sensor;

    // Room B temperature
    root.getElementById('target-temp').textContent =
      isNaN(tgtTemp) ? '--' : tgtTemp.toFixed(1);

    // Fan status + duration
    const fanOn = fanState?.state === 'on';
    const badge = root.getElementById('fan-badge');
    badge.textContent = fanOn ? 'ON' : 'OFF';
    badge.className   = `fan-badge ${fanOn ? 'on' : 'off'}`;
    this._updateFanDuration();

    // ΔT
    const deltaEl = root.getElementById('delta-value');
    if (!isNaN(srcTemp) && !isNaN(tgtTemp)) {
      const dt = srcTemp - tgtTemp;
      deltaEl.textContent = (dt >= 0 ? '+' : '') + dt.toFixed(1);
      deltaEl.className   = `delta-value ${dt >= 3 ? 'pos' : dt > 0 ? 'mid' : 'neg'}`;
    } else {
      deltaEl.textContent = '--';
      deltaEl.className   = 'delta-value mid';
    }

    // Slider — only update when user is not dragging
    if (target_entity && numState) {
      const slider = root.getElementById('target-slider');
      if (slider && !slider.matches(':active')) {
        slider.min   = numState.attributes.min  ?? 15;
        slider.max   = numState.attributes.max  ?? 30;
        slider.step  = numState.attributes.step ?? 0.5;
        slider.value = parseFloat(numState.state);
        root.getElementById('slider-display').textContent =
          parseFloat(numState.state).toFixed(1);
      }
    }
  }

  _updateFanDuration() {
    if (!this._hass || !this._config) return;
    const fanState = this._hass.states[this._config.fan_switch];
    const el = this.shadowRoot.getElementById('fan-duration');
    if (!el || !fanState) return;

    if (fanState.state === 'on' && fanState.last_changed) {
      const ms = Date.now() - new Date(fanState.last_changed).getTime();
      el.textContent = this._fmtDuration(ms);
    } else {
      el.textContent = '';
    }
  }

  _fmtDuration(ms) {
    const s = Math.floor(ms / 1000);
    if (s < 60)  return `${s}s`;
    const m = Math.floor(s / 60);
    if (m < 60)  return `${m} min`;
    const h  = Math.floor(m / 60);
    const rm = m % 60;
    return rm ? `${h}h ${rm}min` : `${h}h`;
  }

  getCardSize() { return 3; }
}

// ── Registration ─────────────────────────────────────────────────────────────

customElements.define('diff-temp-card-editor', DiffTempCardEditor);
customElements.define('diff-temp-card', DiffTempCard);

window.customCards ??= [];
window.customCards.push({
  type:        'diff-temp-card',
  name:        'Differential Temperature Card',
  description: 'Companion card for the Differential Temperature Control blueprint',
  preview:     false,
  version:     CARD_VERSION,
});
