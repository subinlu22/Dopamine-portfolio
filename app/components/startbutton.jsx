// app/components/startbutton.jsx
"use client";

import { useState } from 'react';

const StartButton = ({ onStart }) => {
  const [isHover, setIsHover] = useState(false);
  const [isPressed, setIsPressed] = useState(false);

  return (
    <button
      onClick={onStart}
      onMouseEnter={() => setIsHover(true)}
      onMouseLeave={() => {
        setIsHover(false);
        setIsPressed(false);
      }}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      style={{
        marginTop: '65px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '15px 34px',
        borderRadius: '999px',
        border: isHover
          ? '0px solid rgba(255,255,255,.5)'
          : '0px solid rgba(255,255,255,.25)',
        background: isHover
          ? 'rgba(255,255,255,.12)'
          : 'rgba(255,255,255,.05)',
        backdropFilter: isHover ? 'blur(14px)' : 'blur(6px)',
        WebkitBackdropFilter: isHover ? 'blur(14px)' : 'blur(6px)',
        boxShadow: isHover ? '0 8px 32px rgba(255,255,255,.08)' : 'none',
        color: 'rgba(255, 255, 255, 0.95)',
        fontSize: '16px',
        fontWeight: '700',
        letterSpacing: '0.28em',
        cursor: 'pointer',
        transition: 'all .25s ease',
        transform: isPressed ? 'scale(0.94)' : isHover ? 'scale(1.02)' : 'scale(1)',
      }}
    >
      START
    </button>
  );
};

export default StartButton;