// app/components/hero.jsx
"use client";

const Hero = () => {
  return (
    <section
      className="
        flex
        flex-1
        flex-col
        items-center
        justify-center
        px-8
        text-center
      "
    >
      {/* Main Title */}
      <h2
        className="
          text-white
          text-[48px]
          md:text-[56px]
          lg:text-[64px]
          font-extrabold
          leading-tight
          tracking-tight
          drop-shadow-lg
          select-none
        "
      >
        오늘의 감정을
        <br />
        음악으로 기록하세요.
      </h2>

      {/* Description */}
      <p
        className="
          mt-8
          max-w-[500px]
          text-[16px]
          md:text-[18px]
          lg:text-[20px]
          leading-8
          text-white/80
          font-normal
          drop-shadow-md
        "
      >
        텍스트, 손글씨, 음성, 영상을
        <br />
        AI가 하나의 음악으로 만들어드립니다.
      </p>

      {/* Slogan */}
      <p
        className="
          mt-12
          text-sm
          md:text-base
          italic
          tracking-wide
          text-white/60
          select-none
        "
      >
        "당신의 하루를 하나의 노래로."
      </p>
    </section>
  );
};

export default Hero;
