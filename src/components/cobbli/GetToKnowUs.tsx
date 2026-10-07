const INSTAGRAM_URL = "https://www.instagram.com/cobblidotcom/";

export default function GetToKnowUs() {
  return (
    <section style={{ backgroundColor: "#fff5cc" }}>
      <div className="container py-14 md:py-16 text-center">
        <h2
          className="text-5xl md:text-7xl uppercase"
          style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, color: "#3d1700" }}
        >
          Get to know us
        </h2>
        <a
          href={INSTAGRAM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block mt-4 text-xl md:text-2xl font-semibold underline"
          style={{ fontFamily: "'Instrument Sans', sans-serif", color: "#3d1700" }}
        >
          @cobblidotcom
        </a>
        {/* Static layout placeholders until the team's Instagram integration is ready. */}
        <div className="mt-10 grid grid-cols-3 gap-3 md:gap-6" aria-hidden="true">
          {["#fdb600", "#3d1700", "#fdb600"].map((color, index) => (
            <div key={index} className="aspect-square rounded-xl" style={{ backgroundColor: color }} />
          ))}
        </div>
      </div>
    </section>
  );
}
