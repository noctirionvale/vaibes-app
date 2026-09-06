import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useAlarm } from '../context/AlarmContext';
import './VibeClock.css';

const VibeClock = (props) => {
  const ctx = useAlarm();

  // Falls back to the shared AlarmContext by default. Props still win if a
  // parent explicitly passes them (kept for forward-compat / testing), but
  // nothing currently does — every instance of VibeClock, wherever it's
  // rendered, now reads and writes the same always-mounted alarm state.
  const mode           = props.mode           ?? ctx.mode;
  const alarmHour      = props.alarmHour      ?? ctx.alarmHour;
  const alarmMinute    = props.alarmMinute    ?? ctx.alarmMinute;
  const alarmPeriod    = props.alarmPeriod    ?? ctx.alarmPeriod;
  const alarmSet       = props.alarmSet       ?? ctx.alarmSet;
  const alarmTriggered = props.alarmTriggered ?? ctx.alarmTriggered;

  const setMode        = props.onModeChange        ?? ctx.setMode;
  const setAlarmHour   = props.onAlarmHourChange   ?? ctx.setAlarmHour;
  const setAlarmMinute = props.onAlarmMinuteChange ?? ctx.setAlarmMinute;
  const setAlarmPeriod = props.onAlarmPeriodChange ?? ctx.setAlarmPeriod;
  const setAlarmSet    = props.onAlarmSetChange    ?? ctx.setAlarmSet;
  const stopAlarm      = props.onStopAlarm         ?? ctx.stopAlarm;
  const cancelAlarm    = props.onCancelAlarm       ?? ctx.cancelAlarm;
  const computeNextAlarmTimestamp = ctx.computeNextAlarmTimestamp;

  // Which picker is open: 'hour' | 'minute' | null
  const [openPicker, setOpenPicker] = useState(null);
  const [pickerPos, setPickerPos] = useState({ top: 0, left: 0 });

  const hourDigitRef   = useRef(null);
  const minuteDigitRef = useRef(null);

  // Close picker on outside click
  useEffect(() => {
    if (!openPicker) return;
    const handleOutside = (e) => {
      if (
        !e.target.closest('.alarm-picker-anchor') &&
        !e.target.closest('.alarm-picker-portal')
      ) {
        setOpenPicker(null);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [openPicker]);

  // Recalculate picker position — flips upward if not enough room below
  const PICKER_H = 160; // must match max-height in CSS
  const recalcPos = useCallback((ref) => {
    if (!ref?.current) return;
    const rect       = ref.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp     = spaceBelow < PICKER_H + 8;
    setPickerPos({
      top:    openUp ? rect.top - PICKER_H - 4 : rect.bottom + 4,
      left:   rect.left + rect.width / 2,
      openUp,
    });
  }, []);

  useEffect(() => {
    if (!openPicker) return;
    const ref = openPicker === 'hour' ? hourDigitRef : minuteDigitRef;
    recalcPos(ref);
    const onScroll = () => recalcPos(ref);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [openPicker, recalcPos]);

  const openPickerFor = (which) => {
    const ref = which === 'hour' ? hourDigitRef : minuteDigitRef;
    if (openPicker === which) { setOpenPicker(null); return; }
    recalcPos(ref);
    setOpenPicker(which);
  };

  const toggleMode = () => {
    setOpenPicker(null);
    setMode(mode === 'clock' ? 'alarm' : 'clock');
  };

  const handleSetAlarm = () => {
  let hour24 = alarmHour;
  if (alarmPeriod === 'PM' && alarmHour !== 12) hour24 = alarmHour + 12;
  if (alarmPeriod === 'AM' && alarmHour === 12) hour24 = 0;
  setAlarmSet({
    hour:    hour24,
    minute:  alarmMinute,
    display: `${alarmHour.toString().padStart(2, '0')}:${alarmMinute.toString().padStart(2, '0')}`,
    period:  alarmPeriod,
    targetTimestamp: computeNextAlarmTimestamp(hour24, alarmMinute),
  });
  setOpenPicker(null);
};;

  const [currentTime, setCurrentTime] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const hours       = currentTime.getHours();
  const mins        = currentTime.getMinutes();
  const secs        = currentTime.getSeconds();
  const ampm        = hours >= 12 ? 'PM' : 'AM';
  const displayHour = (hours % 12 || 12).toString().padStart(2, '0');
  const displayMin  = mins.toString().padStart(2, '0');
  const dateStr     = currentTime.toLocaleDateString('en-US', {
    weekday: 'short', month: 'long', day: 'numeric',
  }).toUpperCase();

  const RING_R = 47;
  const RING_C = 2 * Math.PI * RING_R;
  const ringOffset = RING_C * (1 - secs / 60);

  const prevSecsRef = useRef(secs);
  const [ringTransition, setRingTransition] = useState(true);
  useEffect(() => {
    if (secs === 0 && prevSecsRef.current === 59) {
      setRingTransition(false);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setRingTransition(true));
      });
    }
    prevSecsRef.current = secs;
  }, [secs]);

  const hourOptions   = Array.from({ length: 12 }, (_, i) => i + 1);
  const minuteOptions = Array.from({ length: 60 }, (_, i) => i);

  const pickerRef = useRef(null);
  useEffect(() => {
    if (!openPicker || !pickerRef.current) return;
    const selected = pickerRef.current.querySelector('.alarm-picker-option.selected');
    if (selected) selected.scrollIntoView({ block: 'center' });
  }, [openPicker]);

  return (
    <div className="vibe-clock">
      <div className="clock-face">
        <svg className="clock-progress-ring" viewBox="0 0 100 100" aria-hidden="true">
          <circle className="clock-progress-track" cx="50" cy="50" r={RING_R} />
          <circle
            className="clock-progress-fill"
            cx="50" cy="50" r={RING_R}
            style={{
              strokeDasharray: RING_C,
              strokeDashoffset: ringOffset,
              transition: ringTransition ? 'stroke-dashoffset 1s linear' : 'none',
            }}
          />
        </svg>

        <div className="clock-inner">

          <div className="clock-toggle-wrap">
            <button
              className={`clock-toggle mode-${mode}`}
              onClick={toggleMode}
              aria-label="Toggle clock / alarm"
            />
          </div>

          {mode === 'clock' && (
            <div className="clock-display">
              <div className="clock-time-big">
                {displayHour}:{displayMin}
                <span className="clock-ampm-big">{ampm}</span>
              </div>
              <div className="clock-date-big">{dateStr}</div>
              <div className="clock-seconds-tick">
                {secs.toString().padStart(2, '0')}s
              </div>
            </div>
          )}

          {mode === 'alarm' && (
            <div className="alarm-display">
              {!alarmSet ? (
                <>
                  <div className="alarm-time-big">
                    <span className="alarm-picker-anchor">
                      <span
                        ref={hourDigitRef}
                        className={`alarm-digit${openPicker === 'hour' ? ' active' : ''}`}
                        onClick={() => openPickerFor('hour')}
                      >
                        {alarmHour.toString().padStart(2, '0')}
                      </span>
                    </span>

                    <span className="alarm-colon">:</span>

                    <span className="alarm-picker-anchor">
                      <span
                        ref={minuteDigitRef}
                        className={`alarm-digit${openPicker === 'minute' ? ' active' : ''}`}
                        onClick={() => openPickerFor('minute')}
                      >
                        {alarmMinute.toString().padStart(2, '0')}
                      </span>
                    </span>

                    <span
                      className="alarm-period-pill"
                      onClick={() => setAlarmPeriod(p => p === 'AM' ? 'PM' : 'AM')}
                    >
                      {alarmPeriod}
                    </span>
                  </div>

                  <div className="alarm-action">
                    <button className="alarm-set-btn" onClick={handleSetAlarm}>SET</button>
                  </div>
                </>
              ) : (
                <>
                  <div className="alarm-time-big">
                    <span className="alarm-active-time">{alarmSet.display}</span>
                    <span className="alarm-period-pill" style={{ cursor: 'default' }}>
                      {alarmSet.period}
                    </span>
                  </div>
                  <div className="alarm-label">ACTIVE</div>
                  <div className="alarm-action">
                    <button className="alarm-cancel-btn" onClick={cancelAlarm}>CANCEL</button>
                  </div>
                </>
              )}
            </div>
          )}

          {alarmTriggered && (
            <div className="alarm-ringing-overlay">
              <div className="alarm-ringing">
                <span>🔔</span>
                Time's up!
                <button onClick={stopAlarm} className="stop-alarm-btn">Stop</button>
              </div>
            </div>
          )}

        </div>
      </div>

      {openPicker && (
        <div
          ref={pickerRef}
          className="alarm-picker-portal"
          style={{
            position:  'fixed',
            top:       pickerPos.top,
            left:      pickerPos.left,
            transform: 'translateX(-50%)',
            zIndex:    9999,
          }}
        >
          {(openPicker === 'hour' ? hourOptions : minuteOptions).map(val => (
            <div
              key={val}
              className={`alarm-picker-option${
                (openPicker === 'hour' ? alarmHour : alarmMinute) === val ? ' selected' : ''
              }`}
              onClick={() => {
                openPicker === 'hour' ? setAlarmHour(val) : setAlarmMinute(val);
                setOpenPicker(null);
              }}
            >
              {val.toString().padStart(2, '0')}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default VibeClock;