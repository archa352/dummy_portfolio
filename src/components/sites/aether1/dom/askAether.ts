import { ease, gsap, isMobile } from "./eases";

type State = {
  name: string;
  width: string;
  height: string;
  radius: string;
  label: string;
  modal?: boolean;
};

const STATES = {
  INITIAL: { name: "initial", width: "16rem", height: "4.2rem", radius: "6rem", label: "Ask Aether" },
  EXPANDED: { name: "expanded", width: "29rem", height: "14rem", radius: "2.2rem", label: "How can I guide you?" },
  THINKING: { name: "thinking", width: "29rem", height: "4.2rem", radius: "2.2rem", label: "Thinking..." },
  RESPONSE: { name: "response", width: "29rem", height: "4.2rem", radius: "2.2rem", label: "Another question?" },
  MODAL_INITIAL: { name: "modal-initial", width: "33.5rem", height: "4.2rem", radius: "2.2rem", label: "Ask me for more", modal: true },
  MODAL_EXPANDED: { name: "modal-expanded", width: "33.5rem", height: "20rem", radius: "2rem", label: "Tell me more", modal: true },
  MODAL_THINKING: { name: "modal-thinking", width: "33.5rem", height: "4.2rem", radius: "2.2rem", label: "Wait a second...", modal: true },
} satisfies Record<string, State>;

type Answer = { question: string; title: string; short: string; long: string; media: string; cta: string };

const AVATARS = { primary: "/sites/aether1/ai-images/avatar1.webp", secondary: "/sites/aether1/ai-images/avatar2.webp" };
const CTA_LINKS: Record<string, { label: string; href: string }> = {
  CTA_1: { label: "View Specs", href: "https://aether1.ai/specs" },
  CTA_2: { label: "Contact OFF+BRAND.", href: "https://itsoffbrand.com" },
  CTA_3: { label: "Preorder", href: "https://aether1.ai/preorder" },
};

const html = document.documentElement;
const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);

/** "Ask Aether" assistant: expanding prompt, thinking state, answer card and history modal. */
export class AskAether {
  private wrapper: HTMLElement;
  private button: HTMLElement;
  private inner: HTMLButtonElement;
  private label: HTMLElement;
  private icon: SVGElement;
  private questionWrapper: HTMLElement;
  private question: HTMLTextAreaElement;
  private responseWrapper: HTMLElement;
  private responseText: HTMLElement;
  private responseTitle: HTMLElement;
  private responseVisual: HTMLImageElement;
  private close: HTMLElement;
  private ctas: Record<string, HTMLButtonElement>;
  private modal: HTMLElement;
  private modalSlot: HTMLElement;
  private accordions: HTMLElement;
  private home: HTMLElement;
  private indicator: HTMLElement | null;
  private state: State = STATES.INITIAL;
  private animating = false;
  private submitting = false;
  private thinking: gsap.core.Timeline | null = null;
  private history: Answer[] = [];
  private modalAnim: gsap.core.Timeline;
  private controller: AbortController | null = null;

  constructor(
    private form: HTMLElement,
    private hooks: { playUI: (name: "uiAskAetherOpen" | "uiQuestionSend" | "uiReply") => void; setIdleScroll: (allowed: boolean) => void },
  ) {
    const q = <T extends Element = HTMLElement>(key: string) => form.querySelector<T>(`[data-ai='${key}']`)!;
    this.wrapper = q("buttonWrapper");
    this.button = q("button");
    this.inner = q<HTMLButtonElement>("buttonInner");
    this.label = q("buttonLabel");
    this.icon = q<SVGElement>("icon");
    this.questionWrapper = q("questionWrapper");
    this.question = q<HTMLTextAreaElement>("question");
    this.responseWrapper = q("responseWrapper");
    this.responseText = q("response");
    this.responseTitle = q("title");
    this.responseVisual = q<HTMLImageElement>("visual");
    this.close = q("closeQuestion");
    this.ctas = { CTA_1: q("CTA_1"), CTA_2: q("CTA_2"), CTA_3: q("CTA_3"), CTA_4: q("CTA_4") };
    this.modal = document.querySelector<HTMLElement>("[data-ai='modal']")!;
    this.modalSlot = this.modal.querySelector<HTMLElement>(".modal__aether-w")!;
    this.accordions = this.modal.querySelector<HTMLElement>("[data-ai='accordionWrapper']")!;
    this.home = form.parentElement!;
    this.indicator = document.querySelector<HTMLElement>(".indicator-w");

    this.responseWrapper.style.display = "none";
    gsap.set(Object.values(this.ctas), { display: "none" });
    gsap.set(this.modal, { autoAlpha: 0, display: "none" });
    this.modalAnim = gsap
      .timeline({ paused: true })
      .set(this.modal, { autoAlpha: 1, display: "flex" })
      .fromTo(
        this.modal,
        { scale: 1.05, opacity: 0, filter: "blur(0.5rem)", transformOrigin: "center center" },
        { duration: 0.8, ease: "expo.out", scale: 1, opacity: 1, filter: "blur(0px)" },
        "<",
      );

    this.inner.addEventListener("click", this.onToggle);
    this.close.addEventListener("click", this.onCloseResponse);
    this.ctas.CTA_4.addEventListener("click", this.openModal);
    for (const key of ["CTA_1", "CTA_2", "CTA_3"]) {
      this.ctas[key].addEventListener("click", () => window.open(CTA_LINKS[key].href, "_blank", "noopener"));
    }
    this.modal.querySelector(".modal__close-w")?.addEventListener("click", this.onModalClose);
    window.addEventListener("keydown", this.onKeyDown);
  }

  private onToggle = () => {
    if (this.submitting) return;
    const next: Partial<Record<string, State>> = {
      initial: STATES.EXPANDED,
      "modal-initial": STATES.MODAL_EXPANDED,
      "modal-expanded": STATES.MODAL_INITIAL,
      thinking: STATES.EXPANDED,
    };
    void this.transitionTo(next[this.state.name] ?? STATES.INITIAL);
  };

  private onCloseResponse = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    this.controller?.abort();
    this.thinking?.kill();
    this.responseWrapper.style.display = "none";
    if (html.classList.contains("has-modal-open")) this.closeModal();
    void this.transitionTo(STATES.INITIAL);
  };

  private onKeyDown = (event: KeyboardEvent) => {
    if (this.animating) return;
    if (event.key === "Escape" && this.state === STATES.EXPANDED) void this.transitionTo(STATES.INITIAL);
    if (event.key === "Escape" && html.classList.contains("has-modal-open")) this.onModalClose(event);
    if (event.key === "Enter" && (this.state === STATES.EXPANDED || this.state === STATES.MODAL_EXPANDED)) {
      event.preventDefault();
      if (this.question.value.trim().length < 4) {
        gsap.to(this.questionWrapper, {
          keyframes: [{ x: -8 }, { x: 8 }, { x: -8 }, { x: 8 }, { x: 0 }],
          ease: "none",
          duration: 0.4,
          onComplete: () => gsap.set(this.questionWrapper, { clearProps: "x" }),
        });
        return;
      }
      void this.submit();
    }
  };

  private onOutside = (event: MouseEvent) => {
    if (this.state === STATES.EXPANDED && !this.form.contains(event.target as Node) && !this.animating) {
      void this.transitionTo(STATES.INITIAL);
    }
  };

  private expandTimeline(state: State) {
    return gsap
      .timeline({
        defaults: { ease: ease.customEase, duration: 0.4 },
        onStart: () => {
          this.hooks.setIdleScroll(false);
          if (isMobile() && this.indicator) gsap.to(this.indicator, { autoAlpha: 0, yPercent: 100, filter: "blur(0.5rem)", duration: 0.8 });
        },
        onComplete: () => {
          this.question.disabled = false;
          this.question.focus();
        },
      })
      .fromTo(
        this.questionWrapper,
        { autoAlpha: 0, scale: 0.95, attr: { "data-after": "" } },
        { delay: 0.2, autoAlpha: 1, scale: 1, transformOrigin: "bottom center", attr: { "data-after": "Press Enter to send" } },
      )
      .to(this.label, { text: state.label }, "<")
      .to(this.icon, { rotate: 180 }, "<");
  }

  private collapseTimeline(state: State) {
    this.hideResponse();
    return gsap
      .timeline({
        defaults: { ease: ease.instantEase, duration: 0.4 },
        onStart: () => this.hooks.setIdleScroll(true),
        onComplete: () => {
          if (isMobile() && this.indicator) gsap.to(this.indicator, { autoAlpha: 1, yPercent: 0, filter: "blur(0rem)", duration: 0.8 });
        },
      })
      .set(this.questionWrapper, { autoAlpha: 0, attr: { "data-after": "" } })
      .set(this.inner, { pointerEvents: "auto" })
      .to(this.icon, { rotate: 0 }, "<")
      .to(this.label, { text: state.label }, "<");
  }

  private thinkingTimeline(state: State) {
    const tl = gsap.timeline({ defaults: { ease: ease.customEase, duration: 0.3 }, onComplete: () => html.classList.add("has-ai-thinking") });
    tl.to(this.label, {
      text: state.label,
      onStart: () => {
        this.question.disabled = true;
        this.inner.style.pointerEvents = "none";
      },
    });
    const props = { width: state.modal ? "33.5rem" : "29rem", height: "auto", marginBottom: 0, attr: { "data-after": "" } };
    if (state.modal) tl.set(this.questionWrapper, { ...props, autoAlpha: 0 }, "<");
    else tl.to(this.questionWrapper, { ...props, autoAlpha: 0.7 }, "<");
    tl.to(this.icon, { rotate: -180, transformOrigin: "50% 50%", duration: 0.8, repeat: -1, ease: "none" }, "<");
    return tl;
  }

  private async transitionTo(state: State) {
    if (this.animating || state === this.state) return;
    this.animating = true;
    if (state === STATES.EXPANDED || state === STATES.MODAL_EXPANDED) this.hooks.playUI("uiAskAetherOpen");
    if (state === STATES.THINKING || state === STATES.MODAL_THINKING) this.hooks.playUI("uiQuestionSend");
    gsap.killTweensOf([this.questionWrapper, this.label, this.icon]);
    this.form.classList.toggle("modal", Boolean(state.modal));
    html.classList.toggle("has-ai-thinking", state === STATES.THINKING || state === STATES.MODAL_THINKING);
    html.classList.remove("has-ai-error");
    gsap.to(this.button, { color: "#fff", duration: 0.3 });

    if (state === STATES.THINKING || state === STATES.MODAL_THINKING) this.thinking = this.thinkingTimeline(state);
    else if (state === STATES.EXPANDED || state === STATES.MODAL_EXPANDED) this.expandTimeline(state);
    else this.collapseTimeline(state);

    await new Promise<void>((resolve) => {
      gsap.to(this.button, { width: state.width, height: state.height, borderRadius: state.radius, duration: 0.4, ease: ease.gentleIn, onComplete: resolve });
      gsap.to(this.wrapper, { borderRadius: state.radius, duration: 0.4, ease: ease.gentleIn });
    });
    this.state = state;
    this.animating = false;
    html.classList.toggle("has-ai-open", state !== STATES.INITIAL && state !== STATES.MODAL_INITIAL);
    if (state === STATES.EXPANDED) document.addEventListener("click", this.onOutside);
    else document.removeEventListener("click", this.onOutside);
  }

  private async submit() {
    if (this.submitting) return;
    this.submitting = true;
    const question = this.question.value.trim();
    const inModal = this.state === STATES.MODAL_EXPANDED;
    this.controller = new AbortController();
    try {
      await this.transitionTo(inModal ? STATES.MODAL_THINKING : STATES.THINKING);
      const response = await fetch("/api/aether", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
        signal: this.controller.signal,
      });
      if (!response.ok) throw new Error(`Request failed: ${response.status}`);
      const { answer } = (await response.json()) as { answer: string };
      const [title = "", short = "", long = "", media = "", cta = ""] = answer.split("|").map((part) => part.trim());
      const entry = { question, title, short, long, media, cta };
      this.history.unshift(entry);
      this.renderHistory();
      if (inModal) {
        this.thinking?.kill();
        this.openAccordion(0);
        await this.transitionTo(STATES.MODAL_INITIAL);
        this.question.value = "";
      } else {
        this.showResponse(entry);
      }
    } catch (error) {
      if (!this.controller?.signal.aborted) this.showError();
      console.error("Ask Aether failed:", error);
    } finally {
      this.submitting = false;
      this.controller = null;
    }
  }

  private showResponse(answer: Answer) {
    this.hooks.playUI("uiReply");
    this.responseWrapper.style.marginBottom = `${this.questionWrapper.getBoundingClientRect().height + 6}px`;
    this.responseText.textContent = answer.short;
    this.responseTitle.textContent = answer.title;
    this.responseVisual.src = answer.cta === "CTA_3" ? AVATARS.secondary : AVATARS.primary;
    this.responseWrapper.style.display = "flex";
    this.thinking?.kill();
    this.state = STATES.RESPONSE;
    gsap
      .timeline({
        defaults: { ease: ease.customEase, duration: 0.3 },
        onComplete: () => {
          this.inner.style.pointerEvents = "auto";
        },
      })
      .to(this.label, { text: STATES.RESPONSE.label })
      .to(this.icon, { rotate: 0, scale: 1, duration: 1, ease: "none" }, "<");
    html.classList.add("has-ai-response");
    html.classList.remove("has-ai-thinking", "has-ai-error");
    gsap.set(Object.values(this.ctas), { display: "none" });
    const cta = this.ctas[answer.cta];
    if (cta) gsap.set(cta, { display: "flex" });
    gsap.fromTo(this.responseWrapper, { autoAlpha: 0, scale: 1.2, filter: "blur(1rem)" }, { autoAlpha: 1, scale: 1, filter: "blur(0rem)", duration: 0.3 });
  }

  private hideResponse() {
    if (this.responseWrapper.style.display === "none") return;
    gsap.to(this.responseWrapper, {
      autoAlpha: 0,
      scale: 1.2,
      filter: "blur(1rem)",
      transformOrigin: "center center",
      duration: 0.3,
      onComplete: () => {
        this.responseWrapper.style.display = "none";
        this.question.value = "";
        this.question.disabled = false;
        gsap.set(Object.values(this.ctas), { display: "none" });
        gsap.set(this.questionWrapper, { clearProps: "all" });
        html.classList.remove("has-ai-thinking", "has-ai-response");
      },
    });
  }

  private showError() {
    this.thinking?.kill();
    this.question.disabled = false;
    this.inner.style.pointerEvents = "auto";
    this.responseWrapper.style.display = "none";
    html.classList.remove("has-ai-response", "has-ai-thinking");
    html.classList.add("has-ai-error");
    this.state = this.form.classList.contains("modal") ? STATES.MODAL_INITIAL : STATES.INITIAL;
    this.label.textContent = "Error - Try Again";
    gsap.to(this.button, { color: "#F00", duration: 0.3 });
  }

  private renderHistory() {
    this.accordions.innerHTML = this.history
      .map((entry) => {
        const link = CTA_LINKS[entry.cta];
        const cta = link
          ? `<a class="${entry.cta.toLowerCase()}" href="${link.href}" target="_blank" rel="noopener"><div>${link.label}</div></a>`
          : "";
        return `
          <details class="accordion">
            <summary class="accordion__summary">
              <div class="accordion__title-w">
                <div class="accordion__question">${escapeHtml(entry.question)}</div>
                <div class="accordion__title">${escapeHtml(entry.title)}</div>
              </div>
              <div class="accordion__arrow">
                <svg xmlns="http://www.w3.org/2000/svg" width="100%" viewBox="0 0 10 6" fill="none"><path d="M1.19531 1.17749L5.19531 5.17749L9.19531 1.17749" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path></svg>
              </div>
            </summary>
            <div class="accordion__content">
              <h4>${escapeHtml(entry.title)}</h4>
              <figure class="visual__big-w"><img src="${entry.cta === "CTA_3" ? AVATARS.secondary : AVATARS.primary}" alt="" class="visual"></figure>
              <p class="response__long">${escapeHtml(entry.long)}</p>
              ${cta}
            </div>
          </details>`;
      })
      .join("");
    for (const details of this.accordions.querySelectorAll("details")) {
      details.addEventListener("toggle", () => details.classList.toggle("is-active", details.open));
    }
  }

  private openAccordion(index: number) {
    const all = this.accordions.querySelectorAll("details");
    all.forEach((details, i) => (details.open = i === index));
  }

  private openModal = async (event: MouseEvent) => {
    event.stopPropagation();
    html.classList.add("has-modal-open");
    window.setTimeout(() => {
      this.modalAnim.timeScale(1).play();
      this.openAccordion(0);
    }, 200);
    await gsap.to(this.responseWrapper, { autoAlpha: 0, scale: 1.2, filter: "blur(1rem)", duration: 0.3 });
    this.responseWrapper.style.display = "none";
    html.classList.remove("has-ai-response");
    this.question.value = "";
    gsap.set(this.questionWrapper, { clearProps: "all" });
    gsap.set(Object.values(this.ctas), { display: "none" });
    await gsap.to(this.form, { y: 40, opacity: 0, duration: 0.3, ease: ease.customEase });
    this.modalSlot.appendChild(this.form);
    this.state = STATES.RESPONSE;
    await this.transitionTo(STATES.MODAL_INITIAL);
    gsap.to(this.form, { y: 0, opacity: 1, duration: 0.3, ease: ease.customEase });
  };

  private onModalClose = (event: Event) => {
    event.preventDefault();
    this.closeModal();
  };

  private closeModal() {
    if (!html.classList.contains("has-modal-open")) return;
    this.controller?.abort();
    html.classList.remove("has-modal-open");
    this.modalAnim.timeScale(1.2).reverse();
    this.accordions.querySelectorAll("details").forEach((details) => (details.open = false));
    gsap.to(this.form, {
      y: 40,
      opacity: 0,
      duration: 0.3,
      ease: "power2.in",
      onComplete: () => {
        this.home.appendChild(this.form);
        void this.transitionTo(STATES.INITIAL).then(() => gsap.to(this.form, { y: 0, opacity: 1, duration: 0.3, ease: ease.customEase }));
      },
    });
  }

  dispose() {
    this.controller?.abort();
    this.thinking?.kill();
    this.modalAnim.kill();
    this.inner.removeEventListener("click", this.onToggle);
    this.close.removeEventListener("click", this.onCloseResponse);
    this.ctas.CTA_4.removeEventListener("click", this.openModal);
    window.removeEventListener("keydown", this.onKeyDown);
    document.removeEventListener("click", this.onOutside);
    html.classList.remove("has-ai-open", "has-ai-thinking", "has-ai-response", "has-ai-error", "has-modal-open");
  }
}
