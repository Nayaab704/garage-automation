function IntakeSceneryBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-[36vh] min-h-64 max-h-[430px] overflow-hidden"
    >
      <div className="absolute inset-x-0 bottom-0 h-full bg-gradient-to-t from-emerald-50/80 via-emerald-50/30 to-transparent" />
      <svg
        className="absolute inset-x-0 bottom-0 h-full w-full text-slate-200/50"
        preserveAspectRatio="none"
        viewBox="0 0 1200 420"
      >
        <path
          d="M0 250c88-48 120-70 185-48 62 21 92 72 156 56 74-19 85-82 159-52 54 22 73 69 126 58 62-13 95-86 169-67 69 17 87 82 148 75 73-9 91-91 170-87 55 3 90 48 87 82v153H0Z"
          fill="currentColor"
        />
      </svg>
      <svg
        className="absolute inset-x-0 bottom-0 h-full w-full text-emerald-100/70"
        preserveAspectRatio="none"
        viewBox="0 0 1200 420"
      >
        <path
          d="M0 300c68-35 98-87 154-78 63 10 85 80 159 86 86 7 118-77 205-70 82 7 103 84 178 87 76 3 110-74 185-72 75 1 94 73 164 70 62-2 89-59 155-52v149H0Z"
          fill="currentColor"
        />
      </svg>
      <svg
        className="absolute inset-x-0 bottom-0 h-[78%] w-full text-emerald-200/45"
        preserveAspectRatio="none"
        viewBox="0 0 1200 330"
      >
        <path
          d="M0 260c63-66 121-108 187-88 76 23 106 117 191 101 92-17 116-122 213-115 78 6 92 78 164 89 93 15 129-91 224-89 83 2 120 79 201 71 43-4 61-22 82-43v144H0Z"
          fill="currentColor"
        />
      </svg>
      <svg
        className="absolute inset-x-0 bottom-0 h-[52%] w-full text-emerald-900/10"
        preserveAspectRatio="none"
        viewBox="0 0 1200 220"
      >
        <path
          d="M0 154c50-49 103-80 161-62 75 24 91 102 166 93 82-9 100-104 181-112 68-7 97 55 158 65 92 15 127-78 213-78 74 0 106 72 174 72 69 0 105-73 147-87v175H0Z"
          fill="currentColor"
        />
        <path
          d="M0 180c21-24 38-39 65-38 29 2 42 25 75 28 41 3 51-30 92-29 43 1 53 38 99 35 50-4 58-50 107-51 45-1 61 35 105 32 46-3 58-43 104-44 44-1 62 34 106 35 46 1 61-38 106-37 48 1 62 44 111 43 49-2 68-47 116-49 49-1 66 42 103 41 26-1 40-20 61-41v115H0Z"
          fill="currentColor"
          opacity="0.7"
        />
      </svg>
    </div>
  );
}

export default IntakeSceneryBackground;
