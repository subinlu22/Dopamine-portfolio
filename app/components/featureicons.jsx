// app/components/featureicons.jsx
"use client";

const featureList = [
  {
    icon: "✍️",
    title: "일기",
  },
  {
    icon: "📷",
    title: "손글씨",
  },
  {
    icon: "🎤",
    title: "음성",
  },
  {
    icon: "🎥",
    title: "영상",
  },
];

const FeatureIcons = () => {
  return (
    <section className="mt-10 px-6 md:px-8 lg:px-12">
      <div className="flex items-center justify-between gap-4 md:gap-6 lg:gap-8 max-w-[800px] mx-auto">
        {featureList.map((feature) => (
          <div
            key={feature.title}
            className="
              flex
              flex-1
              flex-col
              items-center
              transition-all
              duration-300
              hover:-translate-y-1
            "
          >
            {/* Icon */}
            <div
              className="
                flex
                h-[64px]
                md:h-[72px]
                lg:h-[80px]
                w-[64px]
                md:w-[72px]
                lg:w-[80px]
                items-center
                justify-center
                rounded-full

                border
                border-white/20

                bg-white/15

                backdrop-blur-md

                shadow-lg

                text-[28px]
                md:text-[32px]
                lg:text-[36px]

                transition-all
                duration-300

                hover:bg-white/25
                hover:scale-110
              "
            >
              {feature.icon}
            </div>

            {/* Text */}
            <p
              className="
                mt-4
                text-[14px]
                md:text-[15px]
                lg:text-[16px]
                font-medium
                text-white/90
                tracking-wide
                select-none
              "
            >
              {feature.title}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
};

export default FeatureIcons;