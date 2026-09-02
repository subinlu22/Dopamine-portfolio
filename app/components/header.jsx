"use client";

/*
=========================================
Header Component
서비스 로고 및 타이틀
=========================================
*/

const Header = () => {
  return (
    <header
      className="
        flex
        flex-col
        items-center
        pt-10
        animate-fadeIn
      "
    >
      {/* Logo */}
      <h1
        className="
          text-white
          text-[30px]
          font-bold
          tracking-wide
          select-none
        "
      >
        Dopamine
      </h1>

      {/* Subtitle */}
      <p
        className="
          mt-2
          text-sm
          tracking-[0.35em]
          uppercase
          text-white/70
          select-none
        "
      >
        AI Music Diary
      </p>
    </header>
  );
};

export default Header;
