import Link from "next/link";
import { projectedPointsMarkup } from "./projectedPointsMarkup";

const PLACEHOLDER = "/sites/aether1/images/placeholder.svg";

function LogoMark() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="100%" viewBox="0 0 14 14" fill="none" aria-hidden="true" className="nav__logo">
      <circle cx="12.967" cy="6.90747" r="0.599368" transform="rotate(90 12.967 6.90747)" fill="currentColor" />
      <circle cx="0.599368" cy="0.599368" r="0.599368" transform="matrix(0 1 1 -3.69127e-08 0.226562 6.30811)" fill="currentColor" />
      <circle cx="11.5484" cy="9.54897" r="0.599368" transform="rotate(120 11.5484 9.54897)" fill="currentColor" />
      <circle cx="0.599368" cy="0.599368" r="0.599368" transform="matrix(0.5 0.866025 0.866025 -0.5 1.42578 9.32959)" fill="currentColor" />
      <circle cx="6.89526" cy="6.90748" r="0.885991" transform="rotate(90 6.89526 6.90748)" fill="currentColor" />
      <circle cx="6.89526" cy="12.5852" r="0.885991" transform="rotate(90 6.89526 12.5852)" fill="currentColor" />
      <circle cx="6.89526" cy="1.41456" r="0.885991" transform="rotate(90 6.89526 1.41456)" fill="currentColor" />
      <circle cx="11.5475" cy="4.55259" r="0.599368" transform="rotate(-120 11.5475 4.55259)" fill="currentColor" />
      <circle cx="0.599368" cy="0.599368" r="0.599368" transform="matrix(0.5 -0.866026 -0.866026 -0.5 2.46484 5.37134)" fill="currentColor" />
    </svg>
  );
}

function CtaArrow() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="100%" viewBox="0 0 9 9" fill="none" className="cta__arrow">
      <path d="M4.91455 7.82678L8.2332 4.50853M8.2332 4.50853L4.82233 1.09766M8.2332 4.50853L1.16016 4.50853" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const heroBars: [number, number, number][] = [
  [0.820312, 22.1899, 6.07678],
  [17.25, 15.6794, 19.0975],
  [33.6875, 10.8564, 28.7438],
  [50.1172, 1.46729, 47.5219],
  [66.5469, 10.8564, 28.7438],
  [82.9844, 15.6794, 19.0975],
  [99.4141, 22.1899, 6.07678],
];

function HeroShape() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="100%" viewBox="0 0 101 50" fill="none" data-shapes="hero" aria-hidden="true" className="shape _01">
      {heroBars.map(([x, y, h]) => (
        <g key={x}>
          <rect x={x} y={y} width="1" height={h} fill="white" fillOpacity="0.25" />
          <circle cx={x + 0.5} cy={y} r="0.75" fill="currentColor" />
          <circle cx={x + 0.5} cy={y + h} r="0.75" fill="currentColor" />
        </g>
      ))}
    </svg>
  );
}

function CraftedShape() {
  const dots: [number, number][] = [
    [1.52344, 37.6348],
    [66.9961, 37.6348],
    [50.5625, 20.4941],
    [17.957, 20.4941],
    [34.2578, 25.5117],
    [34.2578, 47.0469],
    [17.957, 1.4668],
    [14.2734, 1.4668],
    [50.5625, 1.4668],
    [54.2461, 1.4668],
  ];
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="100%" viewBox="0 0 68 48" fill="none" data-shapes="crafted" aria-hidden="true" className="shape _02">
      <path
        d="M17.957 1.4668L17.957 9.04702C17.957 18.0506 25.2558 25.3494 34.2594 25.3494V25.3494M50.5617 1.4668V9.04702C50.5617 18.0506 43.2629 25.3494 34.2594 25.3494V25.3494M34.2594 25.3494V47.0467"
        stroke="white"
        strokeOpacity="0.25"
      />
      <path
        d="M14.2734 1.51953V9.1364C14.2734 20.1748 23.2218 29.1231 34.2602 29.1231V29.1231V29.1231C45.2985 29.1231 54.2469 20.1748 54.2469 9.1364V1.51953"
        stroke="white"
        strokeOpacity="0.25"
      />
      {dots.map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="0.75" fill="currentColor" />
      ))}
      <path d="M34.2205 47.1364C34.3102 40.6166 17.2626 23.8595 1.80078 37.5282" stroke="white" strokeOpacity="0.25" />
      <path d="M34.2599 47.1364C34.1703 40.6166 51.2178 23.8595 66.6797 37.5282" stroke="white" strokeOpacity="0.25" />
    </svg>
  );
}

const sections = [
  { id: undefined, mod: "is--hero", title: ["Sound Without", "Boundaries"], desc: ["Elevate your senses through", "timeless resonance"], shape: <HeroShape />, reverse: false },
  { id: "isSound", mod: "is--sound", title: ["Unrivalled", "audio quality"], desc: ["Experience every note as if it", "were born in silence."], shape: <CraftedShape />, reverse: false },
  { id: "isCraft", mod: "is--craft", title: ["Crafted for", "pure clarity."], desc: ["Meticulous future forward", "design & materials"], reverse: true },
  { id: "isControls", mod: "is--controls", title: ["Intuitive", "Controls"], desc: ["Haptic feedback and intuitive", "controls for all environments"], reverse: true },
  { id: "isPower", mod: "is--power", title: ["Sub Alphatonic", "Power Core"], desc: ["Its energy, eternal.", "No charging, no constraints."], reverse: true },
];

export const navLinks = [
  { label: "Home", anchor: 0, href: "/" },
  { label: "Sound", anchor: 1, href: "#" },
  { label: "Craft", anchor: 2, href: "#" },
  { label: "Controls", anchor: 4, href: "#" },
  { label: "Power", anchor: 5, href: "#" },
  { label: "Specs", href: "https://aether1.ai/specs" },
];

/** Static page markup; behaviour is attached by the boot modules. */
export function AetherMarkup() {
  return (
    <>
      <div className="loader-w">
        <div className="loader">
          <div className="loader__circle" />
          <div className="loader__circle">
            <div className="loader__dot dot1" />
          </div>
          <div className="loader__circle">
            <div className="loader__dot dot2" />
          </div>
          <div className="loader__circle">
            <div className="loader__dot dot3" />
          </div>
          <div className="loader__circle" />
          <div className="loader__circle" />
        </div>
        <div aria-hidden="true" className="tagcloud-w" />
      </div>
      <div className="cursor">
        <div className="cursor__inner">
          <div className="cursor__label">[ Click to enable sound ]</div>
        </div>
      </div>
      <div className="main-wrapper">
        <main data-page="homepage" className="main">
          <div data-ai="modal" data-lenis-prevent="" className="modal-w">
            <a href="#" className="modal__close-w w-inline-block" data-ai="modalClose">
              <svg xmlns="http://www.w3.org/2000/svg" width="100%" viewBox="0 0 39 40" fill="none" className="modal__close">
                <circle cx="19.7534" cy="20.0417" r="19.0659" fill="#D7DFE9" />
                <circle cx="14.8244" cy="24.9539" r="1" transform="rotate(-45 14.8244 24.9539)" fill="currentColor" />
                <circle cx="24.6877" cy="24.9912" r="1" transform="rotate(-45 24.6877 24.9912)" fill="currentColor" />
                <circle cx="1" cy="1" r="1" transform="matrix(0.707107 0.707107 0.707107 -0.707107 13.4102 15.1296)" fill="currentColor" />
                <circle cx="1" cy="1" r="1" transform="matrix(0.707107 0.707107 0.707107 -0.707107 18.3203 20.042)" fill="currentColor" />
                <circle cx="1" cy="1" r="1" transform="matrix(0.707107 0.707107 0.707107 -0.707107 23.2734 15.0923)" fill="currentColor" />
              </svg>
              <div>[ &nbsp; close &nbsp; ]</div>
            </a>
            <div className="modal__content">
              <div className="modal__inner">
                <div data-ai="accordionWrapper" className="accordion-w" />
              </div>
            </div>
            <div className="modal__aether-w" />
          </div>
          <header className="navigation-w">
            <Link href="/" aria-current="page" className="nav__logo-w w-inline-block w--current">
              <LogoMark />
              <div>Aether : 1</div>
            </Link>
            <button aria-label="Play audio" data-label="Play audio,Mute audio" aria-pressed="false" type="button" className="sound-w">
              <div>Sound</div>
              <div className="sound__btn">
                <span className="sound__inner">
                  <span className="sound__icon">
                    <svg className="sound__svg">
                      <path d="M0,8 L25,8" />
                    </svg>
                  </span>
                </span>
              </div>
            </button>
            <nav id="main-nav" aria-label="Main navigation" className="navigation">
              <button id="menu-toggle" aria-label="Open main menu" aria-controls="main-nav" aria-expanded="false" type="button" className="nav__header">
                <span className="nav__logo-w mobile w-inline-block" aria-hidden="true">
                  <LogoMark />
                  <div>Aether : 1</div>
                </span>
                <div className="menu__label">menu</div>
                <svg xmlns="http://www.w3.org/2000/svg" width="100%" viewBox="0 0 23 16" fill="none" aria-hidden="true" className="nav__burger">
                  <circle cx="1.59766" cy="1.6709" r="1.25" fill="currentColor" />
                  <circle cx="11.6719" cy="1.6709" r="1.25" fill="currentColor" />
                  <circle cx="21.75" cy="1.6709" r="1.25" fill="currentColor" />
                  <circle cx="1.59766" cy="14.3301" r="1.25" fill="currentColor" />
                  <circle cx="11.6719" cy="14.3301" r="1.25" fill="currentColor" />
                  <circle cx="21.75" cy="14.3301" r="1.25" fill="currentColor" />
                </svg>
                <div className="nav__line" />
              </button>
              <ul inert role="list" className="nav__list">
                {navLinks.map((link) => (
                  <li key={link.label} className="nav__item">
                    <a
                      data-anchor={link.anchor}
                      href={link.href}
                      aria-current={link.anchor === 0 ? "page" : undefined}
                      className={`nav__link${link.anchor === 0 ? " w--current" : ""}`}
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
              <a inert href="https://aether1.ai/preorder" className="nav__cta w-inline-block">
                <div className="btn__text">Preorder</div>
              </a>
            </nav>
          </header>
          {sections.map((section) => (
            <section key={section.mod} id={section.id} className={`s ${section.mod}`}>
              <div className="c">
                <div className={`section-w${section.reverse ? " reverse" : ""}`}>
                  <h1 className="section__title">
                    {section.title[0]} <br />
                    {section.title[1]}
                  </h1>
                  <div className={`section__desc${section.reverse ? " reverse" : ""}`}>
                    {section.shape}
                    <p>
                      {section.desc[0]} <br />
                      {section.desc[1]}
                    </p>
                  </div>
                </div>
              </div>
            </section>
          ))}
          <svg xmlns="http://www.w3.org/2000/svg" width="100%" viewBox="0 0 11 51" fill="none" aria-hidden="true" className="scroll__down">
            {[
              ["0.7", "M1.72269 45.8598L5.46857 49.6056M5.46857 49.6056L9.37628 45.8598M5.46857 49.6056L5.46856 41.6128", "a3"],
              ["0.4", "M1.72269 25.8632L5.46857 29.6091M5.46857 29.6091L9.37628 25.8632M5.46857 29.6091L5.46856 21.6162", "a2"],
              ["0.2", "M1.72269 5.86664L5.46857 9.61248M5.46857 9.61248L9.37628 5.86664M5.46857 9.61248L5.46856 1.61963", "a1"],
            ].map(([opacity, d, className]) => (
              <path key={className} opacity={opacity} d={d} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} />
            ))}
          </svg>
          <section data-ai="w" className="ai__form-w">
            <div data-ai="responseWrapper" className="response-w">
              <figure data-ai="visualWrapper" className="response__visual-w">
                {/* eslint-disable-next-line @next/next/no-img-element -- swapped at runtime with answer media */}
                <img src={PLACEHOLDER} loading="lazy" data-ai="visual" alt="" className="response__visual" />
              </figure>
              <div className="response__inner">
                <div className="response-header">
                  <svg xmlns="http://www.w3.org/2000/svg" width="100%" viewBox="0 0 13 10" fill="none" className="small__logo">
                    <circle cx="1" cy="1" r="1" transform="matrix(1 0 0 -1 0.246094 2.75488)" fill="currentColor" />
                    <circle cx="1" cy="1" r="1" transform="matrix(1 0 0 -1 5.16016 9.66699)" fill="currentColor" />
                    <circle cx="1" cy="1" r="1" transform="matrix(1 0 0 -1 10.1055 2.7168)" fill="currentColor" />
                  </svg>
                  <div data-ai="title">[question theme]</div>
                  <a data-ai="closeQuestion" href="#" className="response__close-w w-inline-block" aria-label="Close answer">
                    <svg xmlns="http://www.w3.org/2000/svg" width="100%" viewBox="0 0 10 9" fill="none" className="response__close">
                      <path d="M0.716285 1.05487L1.42339 0.347764L9.20157 8.12594L8.49446 8.83305L0.716285 1.05487Z" fill="currentColor" />
                      <path d="M8.49302 0.347656L9.20013 1.05476L1.42195 8.83294L0.714844 8.12583L8.49302 0.347656Z" fill="currentColor" />
                    </svg>
                  </a>
                </div>
                <div className="response-content">
                  <div className="response__ai">
                    <p data-ai="response">...</p>
                    <button data-ai="CTA_1" className="cta_1" type="button">
                      <div>View Specs</div>
                      <CtaArrow />
                    </button>
                    <button data-ai="CTA_2" className="cta_2" type="button">
                      <div>Contact OFF+BRAND.</div>
                      <CtaArrow />
                    </button>
                    <button data-ai="CTA_3" className="cta_3" type="button">
                      <div>Preorder</div>
                      <svg xmlns="http://www.w3.org/2000/svg" width="100%" viewBox="0 0 10 9" fill="none" className="cta__arrow">
                        <path
                          d="M0.9375 4.46289C0.9375 4.18675 1.16136 3.96289 1.4375 3.96289H8.51562C8.79177 3.96289 9.01562 4.18675 9.01562 4.46289C9.01562 4.73903 8.79177 4.96289 8.51562 4.96289H1.4375C1.16136 4.96289 0.9375 4.73903 0.9375 4.46289Z"
                          fill="currentColor"
                        />
                        <path
                          d="M4.97656 0.423828C5.25271 0.423828 5.47656 0.647686 5.47656 0.923828L5.47656 8.00195C5.47656 8.2781 5.2527 8.50195 4.97656 8.50195C4.70042 8.50195 4.47656 8.2781 4.47656 8.00195L4.47656 0.923828C4.47656 0.647686 4.70042 0.423828 4.97656 0.423828Z"
                          fill="currentColor"
                        />
                      </svg>
                    </button>
                    <button data-ai="CTA_4" className="cta_4" type="button">
                      <div>More</div>
                      <CtaArrow />
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div data-ai="buttonWrapper" className="ae__btn-w">
              <div data-ai="button" className="ae__btn">
                <button data-ai="buttonInner" className="ae__inner" type="button">
                  <svg xmlns="http://www.w3.org/2000/svg" width="100%" viewBox="0 0 13 10" fill="none" data-ai="icon" className="ae__icon">
                    <circle cx="1.78516" cy="8.57471" r="1" fill="currentColor" className="thinking-dot" />
                    <circle cx="6.69531" cy="1.6626" r="1" fill="currentColor" className="thinking-dot" />
                    <circle cx="11.6484" cy="8.6123" r="1" fill="currentColor" className="thinking-dot" />
                  </svg>
                  <div data-ai="buttonLabel" className="ae__label">
                    Ask Aether
                  </div>
                </button>
                <div data-after="" data-ai="questionWrapper" className="ae__area">
                  <textarea
                    placeholder="Is the sound quality comparable to top ear buds on the market?"
                    data-ai="question"
                    name="question"
                    className="ae__textarea"
                    aria-label="Ask Aether a question"
                  />
                  <div className="question__loader-w">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="100%" className="question__loader">
                      <circle cx="20" cy="20" r="19" fill="none" stroke="#8B929A" strokeWidth="2" />
                      <circle cx="20" cy="20" r="19" fill="none" stroke="#41A5FF" strokeWidth="2" className="question__loader-path" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </section>
          <a href="https://aether1.ai/specs" className="indicator-w w-inline-block">
            <svg xmlns="http://www.w3.org/2000/svg" width="100%" viewBox="0 0 23 22" fill="none" className="indicator__icon">
              <circle cx="11.295" cy="11.116" r="10.499" stroke="currentColor" strokeWidth="0.5" />
              <circle cx="11.295" cy="11.116" r="6.15967" stroke="currentColor" strokeWidth="0.5" />
              <circle cx="11.297" cy="11.116" r="1.5" fill="currentColor" />
            </svg>
            <div className="indicator__label">[ 000 ]</div>
          </a>
        </main>
      </div>
      <div className="canvas-w">
        {projectedPointsMarkup.map((point) => (
          <div
            key={point.name}
            className={`gl__projected-point gl__projected-point--${point.name}`}
            dangerouslySetInnerHTML={{ __html: point.html }}
          />
        ))}
      </div>
    </>
  );
}
