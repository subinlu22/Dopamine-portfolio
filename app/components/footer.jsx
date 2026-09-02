"use client";

/*
=========================================
Footer Component
하단 브랜드 정보
=========================================
*/

const Footer = () => {
  return (
    <footer
      className="
        flex
        flex-col
        items-center
        justify-center

        pb-8
        pt-6

        text-center
      "
    >
      {/* Made with AI */}
      <p
        className="
          text-[12px]
          tracking-[0.2em]
          uppercase
          text-white/60
          select-none
        "
      >
        Made with AI
      </p>

      {/* Brand */}
      <h3
        className="
          mt-2
          text-[15px]
          font-semibold
          tracking-wide
          text-white/80
          select-none
        "
      >
        Dopamine
      </h3>
    </footer>
  );
};

export default Footer;
