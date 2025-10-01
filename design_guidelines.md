{
  "app": {
    "name": "CryptoTrendHunter",
    "type": "AI-powered crypto analysis and trading recommendation dashboard",
    "audience": "Active crypto traders, quants, power users",
    "success_metrics": [
      "Users understand top 5 coin recommendations within 5 seconds",
      "Users schedule analysis intervals in 2 clicks",
      "Confidence gauges + TP/SL visible above the fold on desktop",
      "Clear bot status across 20 bots with error states discoverable"
    ]
  },

  "brand": {
    "attributes": ["trustworthy", "precise", "tech-forward", "quietly confident"],
    "visual_style": "Dark fintech with crisp neon accents (teal/sea), restrained gradients, data-first hierarchy, subtle glass for overlays, Swiss-style alignment with grid discipline"
  },

  "design_tokens": {
    "css_custom_properties": ":root{ --bg:#0b0f14; --bg-elev-1:#0e1218; --bg-elev-2:#121722; --surface:#12161d; --panel:#0f141b; --muted:#99a3ad; --text:#e7eef5; --text-soft:#c7d0d9; --primary:#16d3b0; --primary-600:#11b89a; --primary-700:#0e9f86; --accent:#22b8f0; --accent-700:#1b9dcc; --success:#37d399; --warning:#ffd166; --danger:#ff6b6b; --ring:#22b8f0; --focus:#22b8f0; --card-border:rgba(255,255,255,0.06); --chart-green:#2dd4bf; --chart-red:#f87171; --chart-amber:#fbbf24; --chart-cyan:#22d3ee; --shadow-soft:0 2px 12px rgba(0,0,0,0.35); --shadow-deep:0 10px 30px rgba(0,0,0,0.45); --radius-sm:6px; --radius-md:10px; --radius-lg:14px; --btn-radius:10px; --btn-shadow:0 2px 8px rgba(0,0,0,0.45); --space-1:4px; --space-2:8px; --space-3:12px; --space-4:16px; --space-6:24px; --space-8:32px; --space-10:40px; --space-12:48px; }",
    "tailwind_theme_mapping": {
      "background": "var(--bg)",
      "foreground": "var(--text)",
      "primary": "var(--primary)",
      "muted": "var(--muted)",
      "ring": "var(--ring)"
    }
  },

  "color_palette": {
    "backgrounds": {
      "base": "#0B0F14",
      "elevated": "#0E1218",
      "panel": "#121722"
    },
    "text": { "primary": "#E7EEF5", "muted": "#C7D0D9", "disabled": "#8B96A1" },
    "accents": {
      "primary_teal": "#16D3B0",
      "aqua_blue": "#22B8F0",
      "success": "#37D399",
      "warning": "#FFD166",
      "danger": "#FF6B6B"
    },
    "data_viz": { "green": "#2DD4BF", "red": "#F87171", "amber": "#FBBF24", "cyan": "#22D3EE" },
    "notes": [
      "Avoid purple entirely (AI app rule).",
      "Ensure WCAG AA contrast for all text on dark backgrounds.",
      "Use accents sparingly to indicate state and key actions."
    ]
  },

  "gradients_and_texture": {
    "allowed_areas": [
      "App header strip (max-height: 18vh)",
      "Decorative section separators",
      "Large KPI bento tiles (background only, sparse)"
    ],
    "examples": [
      {
        "name": "Teal Mist",
        "css": "bg-[radial-gradient(1200px_600px_at_20%_-10%,rgba(34,184,240,0.18),transparent),radial-gradient(800px_400px_at_90%_0%,rgba(22,211,176,0.18),transparent)]"
      },
      {
        "name": "Ocean Diagonal",
        "css": "bg-[linear-gradient(180deg,rgba(14,18,24,0)_0%,rgba(14,18,24,0.8)_40%,rgba(14,18,24,1)_100%)]"
      }
    ],
    "texture": "Add subtle noise overlay on root container: after:content-[''] after:fixed after:inset-0 after:pointer-events-none after:opacity-10 after:bg-[url('https://grainy-gradients.vercel.app/noise.png')]"
  },

  "typography": {
    "font_pairs": {
      "heading": "Space Grotesk",
      "body": "Inter",
      "numeric_mono": "Roboto Mono"
    },
    "import_example": "<link href=\"https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600&family=Roboto+Mono:wght@400;500;700&display=swap\" rel=\"stylesheet\">",
    "scale": {
      "h1": "text-4xl sm:text-5xl lg:text-6xl tracking-tight font-semibold",
      "h2": "text-base sm:text-lg font-medium text-[color:var(--text-soft)]",
      "body": "text-sm sm:text-base leading-relaxed",
      "caption": "text-xs text-[color:var(--muted)]"
    },
    "usage": [
      "Use Roboto Mono for KPIs, prices, TP/SL, and tick labels",
      "Space Grotesk for headings, Inter for body"
    ]
  },

  "layout": {
    "grid_system": "Mobile-first, 12-col desktop grid (max-w-7xl mx-auto px-4 sm:px-6 lg:px-8)",
    "shell": {
      "header": "Sticky top nav (h-14) with brand at left, Filters + Scheduler at right",
      "sidebar": "Optional left sidebar (min-w-[260px]) on lg+; collapsible on md",
      "content": "Scrollable main panels with section separators and generous spacing (2–3x typical)"
    },
    "page_regions": [
      "Top Nav: brand, search (future), interval selector, filter (All vs Alt)",
      "Bento Row: 4 tiles – PnL, Active Bots, Last Sync, Signals Today",
      "Top 5 Recommendations: cards with confidence gauge, TP/SL, reason",
      "Historical + Strategy Breakdown: candle chart + tabs for indicators",
      "Integrations: Email + Google Sheets settings"
    ],
    "parallax": "Apply mild translateY on hero header strip only (max 8px)"
  },

  "component_path": {
    "button": "./frontend/src/components/ui/button.js",
    "card": "./frontend/src/components/ui/card.js",
    "tabs": "./frontend/src/components/ui/tabs.js",
    "table": "./frontend/src/components/ui/table.js",
    "select": "./frontend/src/components/ui/select.js",
    "toggle_group": "./frontend/src/components/ui/toggle-group.js",
    "switch": "./frontend/src/components/ui/switch.js",
    "input": "./frontend/src/components/ui/input.js",
    "label": "./frontend/src/components/ui/label.js",
    "dialog": "./frontend/src/components/ui/dialog.js",
    "dropdown_menu": "./frontend/src/components/ui/dropdown-menu.js",
    "tooltip": "./frontend/src/components/ui/tooltip.js",
    "calendar": "./frontend/src/components/ui/calendar.js",
    "sonner_toast": "./frontend/src/components/ui/sonner.js",
    "note": "If ./frontend/src/components/ui does not exist, create it and port Shadcn components to .js. Keep named exports (export const Button = ...)."
  },

  "components": {
    "TopNav": {
      "purpose": "Primary actions & filters always accessible",
      "structure": ["Logo/Wordmark left", "Filter (All vs Alt)", "Interval selector (6h/12h/24h)", "Sync/Refresh", "User menu"],
      "classes": "sticky top-0 z-40 backdrop-blur supports-[backdrop-filter]:bg-black/40 border-b border-[var(--card-border)]",
      "button_style": "rounded-[var(--btn-radius)] bg-[var(--surface)] text-[var(--text)] hover:bg-[#171c25] focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
      "testids": [
        "data-testid=\"global-filter-select\"",
        "data-testid=\"interval-toggle-6h\"",
        "data-testid=\"interval-toggle-12h\"",
        "data-testid=\"interval-toggle-24h\"",
        "data-testid=\"refresh-button\""
      ]
    },

    "BotStatusGrid": {
      "purpose": "Show 20 AI bots status in real-time",
      "layout": "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4",
      "card": "bg-[var(--panel)] border border-[var(--card-border)] rounded-[var(--radius-md)] p-3 hover:border-[var(--accent)]/30 transition-colors",
      "states": {
        "running": "text-[var(--success)]",
        "idle": "text-[var(--muted)]",
        "error": "text-[var(--danger)]"
      },
      "testids": ["data-testid=\"bot-card\"", "data-testid=\"bot-status\"", "data-testid=\"bot-latency-ms\""]
    },

    "Top5Recommendations": {
      "purpose": "Show top coins with confidence gauges & TP/SL",
      "layout": "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4",
      "card": "group bg-[var(--surface)] rounded-[var(--radius-lg)] border border-[var(--card-border)] p-4 shadow-[var(--shadow-soft)] hover:shadow-[var(--shadow-deep)] transition-shadow",
      "contents": ["coin avatar+symbol", "confidence gauge 1–10", "TP/SL with mono font", "long/short pill", "brief rationale"],
      "testids": [
        "data-testid=\"coin-card\"",
        "data-testid=\"confidence-gauge\"",
        "data-testid=\"tp-value\"",
        "data-testid=\"sl-value\"",
        "data-testid=\"position-direction\""
      ]
    },

    "Scheduler": {
      "purpose": "Set analysis cadence",
      "control": "ToggleGroup (6h, 12h, 24h) + optional custom via Dialog",
      "states": ["selected", "hover", "focus", "disabled"],
      "testids": ["data-testid=\"scheduler-toggle\"", "data-testid=\"custom-interval-open\"", "data-testid=\"save-interval-button\""]
    },

    "Filters": {
      "purpose": "All coins vs Alt coins only",
      "control": "Select or Segmented Toggle",
      "testids": ["data-testid=\"coin-filter\""]
    },

    "Integrations": {
      "purpose": "Email + Google Sheets settings",
      "layout": "grid grid-cols-1 md:grid-cols-2 gap-6",
      "fields": ["Email toggles & address input", "Google Sheets toggle, sheet ID, worksheet"],
      "testids": [
        "data-testid=\"email-toggle\"",
        "data-testid=\"email-address-input\"",
        "data-testid=\"sheets-toggle\"",
        "data-testid=\"sheet-id-input\"",
        "data-testid=\"worksheet-input\"",
        "data-testid=\"integration-save-button\""
      ]
    },

    "HistoricalAndStrategy": {
      "purpose": "Candles + strategy breakdown",
      "layout": "grid grid-cols-1 lg:grid-cols-3 gap-6",
      "charts": ["Candlestick (2 cols)", "Indicators/Breakdown (1 col)"],
      "testids": ["data-testid=\"candlestick-chart\"", "data-testid=\"indicator-tab\"", "data-testid=\"strategy-breakdown\""]
    },

    "RecommendationCard": {
      "spec": {
        "header": "symbol, direction chip (LONG/SHORT)",
        "gauge": "1–10 colored arc (<=3 red, 4–6 amber, 7–10 teal)",
        "numbers": "TP% / SL% / Entry using mono font",
        "actions": "Execute (future), Share, Copy TP/SL"
      },
      "micro_interactions": [
        "Hover: subtle lift (translate-y-[-2px]) and border-accent/40",
        "Focus: ring-2 ring-[var(--ring)]",
        "Copy: sonner toast confirmation"
      ]
    }
  },

  "interactions_motion": {
    "rules": [
      "Never use transition: all; scope transitions to colors, opacity, shadow",
      "Duration 150–220ms for hover; 250–400ms for entry"
    ],
    "framer_motion": {
      "list_stagger": "viewport entry staggerChildren:0.05, y:8, opacity:0->1",
      "hover_card": "whileHover:{y:-2} whileTap:{scale:0.98}"
    }
  },

  "data_viz": {
    "candles": {
      "lib": "lightweight-charts",
      "install": "npm i lightweight-charts",
      "theme": "background: var(--surface), grid: rgba(255,255,255,0.06), up: var(--chart-green), down: var(--chart-red)",
      "notes": "Prefer 60–70% chart height for main view, disable chart gradients"
    },
    "sparkline": {
      "lib": "recharts",
      "install": "npm i recharts",
      "usage": "<LineChart width=... height=...> ... </LineChart> with stroke colors based on performance"
    },
    "gauge": {
      "option_a": "react-gauge-component (npm i react-gauge-component)",
      "option_b": "Custom D3 arc (d3-shape) for tight visual control",
      "color_bands": [
        { "range": "0-3", "color": "var(--danger)" },
        { "range": "4-6", "color": "var(--warning)" },
        { "range": "7-10", "color": "var(--primary)" }
      ]
    }
  },

  "libraries_and_setup": {
    "install_steps": [
      "npm i framer-motion lightweight-charts recharts d3 d3-shape react-gauge-component sonner",
      "If Shadcn components are missing: create ./frontend/src/components/ui and port JS versions from shadcn/ui (Radix under the hood). Maintain named exports.",
      "Flowbite (optional extras): npm i flowbite-react; import only specific components that fit style"
    ],
    "usage_notes": [
      "All new components must be .js with named exports",
      "Every interactive element must include data-testid attributes"
    ]
  },

  "accessibility": {
    "contrast": "Minimum AA for text against dark backgrounds",
    "focus": "Always visible ring (ring-2 ring-[var(--focus)])",
    "reduced_motion": "Respect prefers-reduced-motion: reduce entry animations"
  },

  "testing_and_testids": {
    "convention": "kebab-case, describe role, not appearance",
    "examples": [
      "data-testid=\"interval-toggle-6h\"",
      "data-testid=\"coin-card\"",
      "data-testid=\"copy-tp-sl-button\"",
      "data-testid=\"email-address-input\"",
      "data-testid=\"candlestick-chart\""
    ]
  },

  "images_urls": [
    {
      "category": "hero/empty-state backdrop",
      "description": "Dark neon trading desk vibe for login or dashboard intro strip",
      "url": "https://images.unsplash.com/photo-1634097537825-b446635b2f7f?crop=entropy&cs=srgb&fm=jpg&q=85"
    },
    {
      "category": "data viz texture",
      "description": "Blurred trading charts for section separators (low opacity overlay only)",
      "url": "https://images.unsplash.com/photo-1689969599087-4120a19816ff?crop=entropy&cs=srgb&fm=jpg&q=85"
    },
    {
      "category": "ambient header",
      "description": "Green matrix-like terminals for subtle brand mood",
      "url": "https://images.unsplash.com/photo-1578070581071-d9b52bf80993?crop=entropy&cs=srgb&fm=jpg&q=85"
    }
  ],

  "css_patches": {
    "remove_center_align": {
      "issue": "index has .App { text-align: center; } which breaks reading flow",
      "action": "Delete that rule or override with .App{text-align:left;}"
    }
  },

  "sample_code": {
    "scheduler_toggle.js": "export const SchedulerToggle = ({value,onChange}) => {\n  const opts = ['6h','12h','24h'];\n  return (\n    <div className=\"inline-flex gap-1 bg-[var(--panel)] p-1 rounded-[10px] border border-[var(--card-border)]\" role=\"tablist\" data-testid=\"scheduler-toggle\">\n      {opts.map(opt=> (\n        <button key={opt} type=\"button\" data-testid=\"interval-toggle-\"+opt\n          onClick={()=>onChange(opt)}\n          className={[\n            'px-3 py-1.5 rounded-[8px] text-sm',\n            value===opt ? 'bg-[var(--surface)] text-[var(--text)]' : 'text-[var(--muted)] hover:text-[var(--text)]'\n          ].join(' ')}\n          style={{transition:'background-color 180ms, color 180ms'}}\n        >{opt.toUpperCase()}</button>\n      ))}\n      <button type=\"button\" className=\"ml-1 px-2 text-xs text-[var(--muted)] hover:text-[var(--text)]\" data-testid=\"custom-interval-open\">Custom</button>\n    </div>\n  );\n};",

    "gauge_component.js": "import GaugeComponent from 'react-gauge-component';\nexport const ConfidenceGauge = ({score=7}) => {\n  // 1-10 scale\n  return (\n    <div data-testid=\"confidence-gauge\">\n      <GaugeComponent\n        arc={{\n          width: 0.2,\n          padding: 0.01,\n          subArcs: [\n            {limit:3, color:'var(--danger)'},\n            {limit:6, color:'var(--warning)'},\n            {limit:10, color:'var(--primary)'}\n          ]\n        }}\n        value={(score/10)*100}\n        labels={{\n          valueLabel: { formatTextValue: v => Math.round((v/100)*10)+'/10', style:{ fill:'var(--text)'} },\n          tickLabels: { type:'outer', ticks:[0,20,40,60,80,100],\n            default: {\n              labelStyle: { fill:'var(--muted)', fontSize: '10px'},\n              tickLength: 4\n            }\n          }\n        }}\n      />\n    </div>\n  );\n};",

    "candlestick_chart.js": "import { createChart } from 'lightweight-charts';\nexport const CandleChart = ({containerId='chart-root', data=[]}) => {\n  // Named export; mount via useEffect in a parent component\n  return null;\n};\n\nexport const mountCandleChart = (el, seriesData) => {\n  const chart = createChart(el, {\n    layout:{ background:{ type:'solid', color: getComputedStyle(document.documentElement).getPropertyValue('--surface').trim() }, textColor: getComputedStyle(document.documentElement).getPropertyValue('--text').trim() },\n    grid:{ vertLines:{ color:'rgba(255,255,255,0.06)' }, horzLines:{ color:'rgba(255,255,255,0.06)'} },\n    rightPriceScale:{ borderVisible:false },\n    timeScale:{ borderVisible:false }\n  });\n  const series = chart.addCandlestickSeries({ upColor:'var(--chart-green)', downColor:'var(--chart-red)', wickUpColor:'var(--chart-green)', wickDownColor:'var(--chart-red)', borderVisible:false });\n  series.setData(seriesData);\n  return chart;\n};"
  },

  "instructions_to_main_agent": [
    "Create ./frontend/src/components/ui and add JS-based Shadcn components with named exports.",
    "Apply tokens by injecting design_tokens.css_custom_properties into index.css (top of file).",
    "Add fonts link tag to public/index.html head or via index.html template.",
    "Replace any .App { text-align:center } with left alignment.",
    "Implement TopNav, BotStatusGrid, Top5Recommendations first to validate spacing and hierarchy.",
    "Integrate lightweight-charts for candles; recharts for sparklines; react-gauge-component for confidence.",
    "Every button/input/select/toggle must include data-testid attributes per convention.",
    "Use sonner toasts for operations (copy TP/SL, save settings)."
  ],

  "web_inspiration": {
    "references": [
      "https://dribbble.com/shots/25482061-Crypto-trading-dashboard-Dark-Mode-UI-Design",
      "https://dribbble.com/shots/26410446-Crypto-Dashboard-UI-Dark-Mode-Trading-Platform-Design",
      "https://dribbble.com/shots/26174737-Crypto-Trading-Dashboard-UI-Dark-Mode-Finance-App-Design"
    ],
    "mix_and_match": "Layout from Swiss-style fintech dashboards, color from oceanic teal/blue palettes, micro-interactions from modern trading UIs"
  },

  "button_system": {
    "variants": {
      "primary": "rounded-[var(--btn-radius)] bg-[var(--primary)] text-black hover:bg-[var(--primary-600)] focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
      "secondary": "rounded-[var(--btn-radius)] bg-[var(--surface)] text-[var(--text)] hover:bg-[#171c25] focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
      "ghost": "rounded-[var(--btn-radius)] text-[var(--text)] hover:bg-white/5"
    },
    "sizes": { "sm": "h-8 px-3 text-xs", "md": "h-10 px-4 text-sm", "lg": "h-12 px-5 text-base" },
    "motion": "hover:translate-y-[-1px] active:scale-[0.99]; transitions limited to colors/shadow"
  },

  "empty_states": {
    "analysis": {
      "message": "No recommendations yet for this interval",
      "cta": "Run analysis",
      "illustration": "use first image_urls item at 10–12% overlay opacity"
    }
  },

  "security_privacy_notes": [
    "Do not display full API keys; mask sensitive tokens in settings",
    "Use visual states for sync success/failure with clear error copy"
  ],

  "general_ui_ux_guidelines": "- You must **not** apply universal transition. Eg: `transition: all`. This results in breaking transforms. Always add transitions for specific interactive elements like button, input excluding transforms\n    - You must **not** center align the app container, ie do not add `.App { text-align: center; }` in the css file. This disrupts the human natural reading flow of text\n   - NEVER: use AI assistant Emoji characters like`🤖🧠💭💡🔮🎯📚🎭🎬🎪🎉🎊🎁🎀🎂🍰🎈🎨🎰💰💵💳🏦💎🪙💸🤑📊📈📉💹🔢🏆🥇 etc for icons. Always use **FontAwesome cdn** or **lucid-react** library already installed in the package.json\n\n **GRADIENT RESTRICTION RULE**\nNEVER use dark/saturated gradient combos (e.g., purple/pink) on any UI element.  Prohibited gradients: blue-500 to purple 600, purple 500 to pink-500, green-500 to blue-500, red to pink etc\nNEVER use dark gradients for logo, testimonial, footer etc\nNEVER let gradients cover more than 20% of the viewport.\nNEVER apply gradients to text-heavy content or reading areas.\nNEVER use gradients on small UI elements (<100px width).\nNEVER stack multiple gradient layers in the same viewport.\n\n**ENFORCEMENT RULE:**\n    • Id gradient area exceeds 20% of viewport OR affects readability, **THEN** use solid colors\n\n**How and where to use:**\n   • Section backgrounds (not content backgrounds)\n   • Hero section header content. Eg: dark to light to dark color\n   • Decorative overlays and accent elements only\n   • Hero section with 2-3 mild color\n   • Gradients creation can be done for any angle say horizontal, vertical or diagonal\n\n- For AI chat, voice application, **do not use purple color. Use color like light green, ocean blue, peach orange etc**\n\n</Font Guidelines>\n\n- Every interaction needs micro-animations - hover states, transitions, parallax effects, and entrance animations. Static = dead. \n   \n- Use 2-3x more spacing than feels comfortable. Cramped designs look cheap.\n\n- Subtle grain textures, noise overlays, custom cursors, selection states, and loading animations: separates good from extraordinary.\n   \n- Before generating UI, infer the visual style from the problem statement (palette, contrast, mood, motion) and immediately instantiate it by setting global design tokens (primary, secondary/accent, background, foreground, ring, state colors), rather than relying on any library defaults. Don't make the background dark as a default step, always understand problem first and define colors accordingly\n    Eg: - if it implies playful/energetic, choose a colorful scheme\n           - if it implies monochrome/minimal, choose a black–white/neutral scheme\n\n**Component Reuse:**\n\t- Prioritize using pre-existing components from src/components/ui when applicable\n\t- Create new components that match the style and conventions of existing components when needed\n\t- Examine existing components to understand the project's component patterns before creating new ones\n\n**IMPORTANT**: Do not use HTML based component like dropdown, calendar, toast etc. You **MUST** always use `/app/frontend/src/components/ui/ ` only as a primary components as these are modern and stylish component\n\n**Best Practices:**\n\t- Use Shadcn/UI as the primary component library for consistency and accessibility\n\t- Import path: ./components/[component-name]\n\n**Export Conventions:**\n\t- Components MUST use named exports (export const ComponentName = ...)\n\t- Pages MUST use default exports (export default function PageName() {...})\n\n**Toasts:**\n  - Use `sonner` for toasts\"\n  - Sonner component are located in `/app/src/components/ui/sonner.tsx`\n\nUse 2–4 color gradients, subtle textures/noise overlays, or CSS-based noise to avoid flat visuals."
}
