with open("src/app/page.tsx", "r") as f:
    lines = f.readlines()

new_header = """        <div className="max-w-xl mx-auto px-3 h-[62px] grid grid-cols-[1fr_auto_1fr] items-center">
          <div className="min-w-0">
            <div className="relative inline-flex items-center gap-1 min-w-0 max-w-[132px] text-slate-600">
              <MapPinned className="w-3 h-3 text-slate-400 flex-shrink-0" strokeWidth={1.8} />
              <select
                ref={originSelectRef}
                value={selectedCity}
                onChange={e => selectManualCity(e.target.value)}
                className="appearance-none bg-transparent text-[11px] text-slate-600 font-medium min-w-0 max-w-[104px] pr-2.5 cursor-pointer focus:outline-none"
                aria-label="Select origin city"
              >
                {MANUAL_ORIGIN_CITIES.map(city => (
                  <option key={city.name} value={city.name}>{city.name}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={openOriginPicker}
                className="absolute right-0 top-1/2 -translate-y-1/2 inline-flex items-center justify-center h-4 w-4 text-slate-400 hover:text-slate-600 transition-colors"
                aria-label="Open city picker"
              >
                <ChevronDown className="w-3 h-3" />
              </button>
            </div>
          </div>

          <div className="relative justify-self-center flex items-center h-full">
            <FomoWordmark className="w-[94px] h-[24px]" />
            <p className="absolute left-1/2 -translate-x-1/2 top-[39px] text-[9px] leading-none text-slate-500 whitespace-nowrap text-center">
              {HEADER_TAGLINES[taglineIndex]}
            </p>
          </div>

          <div className="flex justify-end items-center">
            <div className="inline-flex items-center gap-1 text-[10.5px]">
              <button
                onClick={() => { setTripSpan('daytrip'); setTripSpanTouched(true) }}
                className={`px-1 py-0.5 transition ${tripSpan === 'daytrip' ? 'text-slate-800 font-semibold underline decoration-amber-300 decoration-2 underline-offset-4' : 'text-slate-500 font-medium hover:text-slate-700'}`}
              >
                Today
              </button>
              <span className="text-slate-300">/</span>
              <button
                onClick={() => { setTripSpan('plus1day'); setTripSpanTouched(true) }}
                className={`px-1 py-0.5 transition ${tripSpan === 'plus1day' ? 'text-slate-800 font-semibold underline decoration-amber-300 decoration-2 underline-offset-4' : 'text-slate-500 font-medium hover:text-slate-700'}`}
              >
                Tomorrow
              </button>
            </div>
          </div>
        </div>
"""

# Replace lines 1303 to 1378 (0-indexed, meaning lines 1304 to 1379)
lines[1303:1379] = [new_header]

with open("src/app/page.tsx", "w") as f:
    f.writelines(lines)
