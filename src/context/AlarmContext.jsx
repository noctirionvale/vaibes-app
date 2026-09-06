import React, { createContext, useContext, useRef, useState, useEffect, useCallback } from 'react';

const ALARM_STORAGE_KEY = 'vaibes_vibeclock_alarm_v1';
const AlarmContext = createContext(null);

const computeNextAlarmTimestamp = (hour24, minute) => {
  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour24, minute, 0, 0);
  if (target.getTime() <= now.getTime()) target.setDate(target.getDate() + 1);
  return target.getTime();
};

const loadStoredAlarm = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(ALARM_STORAGE_KEY));
    if (!parsed || typeof parsed.targetTimestamp !== 'number'
        || typeof parsed.hour !== 'number' || typeof parsed.minute !== 'number') return null;
    return parsed;
  } catch { return null; }
};

export const AlarmProvider = ({ children }) => {
  const audioRef = useRef(null);
  const triggeredRef = useRef(false);

  const [mode, setMode] = useState('clock');
  const [alarmHour, setAlarmHour] = useState(12);
  const [alarmMinute, setAlarmMinute] = useState(0);
  const [alarmPeriod, setAlarmPeriod] = useState('AM');
  const [alarmSet, setAlarmSet] = useState(() => {
    const stored = loadStoredAlarm();
    return stored
      ? { hour: stored.hour, minute: stored.minute, display: stored.display, period: stored.period, targetTimestamp: stored.targetTimestamp }
      : null;
  });
  const [alarmTriggered, setAlarmTriggered] = useState(() => !!loadStoredAlarm()?.triggeredAt);

  useEffect(() => { triggeredRef.current = alarmTriggered; }, [alarmTriggered]);

  const fireAlarm = useCallback(() => {
    if (triggeredRef.current) return;
    triggeredRef.current = true;
    setAlarmTriggered(true);
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(e => console.log('Audio play failed:', e));
    }
  }, []);

  // Lives here, mounted once for the whole app for as long as it's open —
  // keeps ticking no matter how many times the study sheet / VibeClock
  // mount and unmount underneath it.
  useEffect(() => {
    const id = setInterval(() => {
      if (alarmSet && !triggeredRef.current && Date.now() >= alarmSet.targetTimestamp) {
        fireAlarm();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [alarmSet, fireAlarm]);

  useEffect(() => {
    if (!alarmSet) {
      try { localStorage.removeItem(ALARM_STORAGE_KEY); } catch {}
      return;
    }
    try {
      localStorage.setItem(ALARM_STORAGE_KEY, JSON.stringify({
        hour: alarmSet.hour,
        minute: alarmSet.minute,
        display: alarmSet.display,
        period: alarmSet.period,
        targetTimestamp: alarmSet.targetTimestamp,
        triggeredAt: alarmTriggered ? Date.now() : null,
      }));
    } catch {}
  }, [alarmSet, alarmTriggered]);

  useEffect(() => {
    const unlockAudio = async () => {
      if (audioRef.current) {
        try {
          await audioRef.current.play();
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
        } catch (e) {}
      }
    };
    const events = ['click', 'keydown', 'touchstart'];
    events.forEach(ev => document.addEventListener(ev, unlockAudio, { once: true }));
    return () => events.forEach(ev => document.removeEventListener(ev, unlockAudio));
  }, []);

  // Stop now fully resets the alarm instead of just silencing it — this is
  // fix #2 (previously "Stop" left the alarm re-armed for the next day).
  const stopAlarm = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setAlarmTriggered(false);
    triggeredRef.current = false;
    setAlarmSet(null);
  }, []);

  const cancelAlarm = useCallback(() => {
    setAlarmSet(null);
    stopAlarm();
  }, [stopAlarm]);

  return (
    <AlarmContext.Provider value={{
      mode, setMode,
      alarmHour, setAlarmHour,
      alarmMinute, setAlarmMinute,
      alarmPeriod, setAlarmPeriod,
      alarmSet, setAlarmSet,
      alarmTriggered,
      stopAlarm, cancelAlarm,
      computeNextAlarmTimestamp,
    }}>
      <audio ref={audioRef} src="/alarm.mp3" preload="auto" loop />
      {children}
    </AlarmContext.Provider>
  );
};

export const useAlarm = () => {
  const ctx = useContext(AlarmContext);
  if (!ctx) throw new Error('useAlarm must be used within an AlarmProvider');
  return ctx;
};