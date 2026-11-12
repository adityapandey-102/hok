"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CONTACT } from "../content";
import { Btn } from "./Btn";
import { MaskText } from "./SectionHead";

type Values = { name: string; email: string; phone: string; brand: string; website: string; message: string };
type Errors = Partial<Record<keyof Values, string>>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function validate(values: Values): Errors {
  const errors: Errors = {};
  if (!values.name.trim()) errors.name = "Please tell us your name.";
  if (!EMAIL.test(values.email.trim())) errors.email = "Please enter a valid email address.";
  if (values.message.trim().length < 10) errors.message = "Please write at least 10 characters.";
  return errors;
}

/** The enquiry as plain text, for the "send it directly" mailto link. */
function enquiryText(values: Values) {
  return [
    `Name: ${values.name}`,
    `Email: ${values.email}`,
    values.phone ? `Phone: ${values.phone}` : "",
    `Brand / company: ${values.brand || "-"}`,
    values.website ? `Website / Instagram: ${values.website}` : "",
    "",
    values.message,
  ]
    .filter((line, i, all) => line !== "" || all[i - 1] !== "")
    .join("\n");
}

/**
 * The one enquiry form, used on /contact (`id="contact-form"`, in a panel with
 * a gradient border) and in the contact modal: filled boxes with a floating
 * label that rises on focus or when filled, a red focus ring, validation on blur
 * and on submit, a full-width Send button with a spinner while sending, and a
 * success state. `initialMessage` pre-fills the message (the Services page
 * buttons use it through the modal).
 */
export function ContactForm({
  variant = "page",
  headingId,
  initialMessage = "",
}: {
  variant?: "page" | "modal";
  headingId?: string;
  initialMessage?: string;
}) {
  const uid = useId();
  const [values, setValues] = useState<Values>({ name: "", email: "", phone: "", brand: "", website: "", message: initialMessage });
  const [errors, setErrors] = useState<Errors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [sent, setSent] = useState<{ name: string; brand: string; text: string } | null>(null);
  const area = useRef<HTMLTextAreaElement>(null);

  // the message box grows with its text (min 5 rows, the CSS sets the minimum height)
  useEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [values.message, state]);

  function setField(key: keyof Values, value: string) {
    const next = { ...values, [key]: value };
    setValues(next);
    if (touched[key]) setErrors((prev) => ({ ...prev, [key]: validate(next)[key] }));
  }

  function blur(key: keyof Values) {
    setTouched((t) => ({ ...t, [key]: true }));
    setErrors((prev) => ({ ...prev, [key]: validate(values)[key] }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (state === "sending") return;
    const found = validate(values);
    setErrors(found);
    setTouched({ name: true, email: true, message: true });
    const first = Object.keys(found)[0];
    if (first) {
      (document.getElementById(`${uid}-${first}`) as HTMLElement | null)?.focus();
      return;
    }
    setState("sending");
    // shortcut: no backend yet; wire to a real endpoint (email or HOK API) before launch
    await new Promise((resolve) => window.setTimeout(resolve, 800));
    setSent({ name: values.name.trim(), brand: values.brand.trim(), text: enquiryText(values) });
    setState("sent");
    try {
      sessionStorage.setItem("hokEnquirySent", "1"); // the modal never pops up again this session
    } catch {
      /* private mode: nothing to remember */
    }
  }

  if (state === "sent" && sent) {
    const subject = `New enquiry: ${sent.brand || sent.name}`;
    return (
      <div className="hok-sent" role="status">
        <svg className="hok-sent__check" viewBox="0 0 52 52" aria-hidden="true">
          <circle cx="26" cy="26" r="24" />
          <path d="M14 27l8 8 16-17" />
        </svg>
        <h3 className="hok-sent__title">Thanks, {sent.name}.</h3>
        <p className="hok-sent__text">We’ll reply within one working day.</p>
        <a
          className="hok-link hok-sent__mail"
          href={`mailto:${CONTACT.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(sent.text)}`}
        >
          Prefer email? Send it directly
        </a>
      </div>
    );
  }

  const field = (key: keyof Values, label: string, type = "text", extra: { autoComplete?: string; inputMode?: "email" | "tel" | "url" | "text" } = {}) => {
    const id = `${uid}-${key}`;
    const error = errors[key];
    return (
      <div className={`hok-field${error ? " has-error" : ""}`}>
        <input
          id={id}
          name={key}
          type={type}
          placeholder=" "
          autoComplete={extra.autoComplete}
          inputMode={extra.inputMode}
          enterKeyHint="next"
          value={values[key]}
          onChange={(e) => setField(key, e.target.value)}
          onBlur={() => blur(key)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-err` : undefined}
        />
        <label htmlFor={id}>{label}</label>
        {error && (
          <p className="hok-error" id={`${id}-err`}>
            {error}
          </p>
        )}
      </div>
    );
  };

  const messageId = `${uid}-message`;
  return (
    <form
      id={variant === "page" ? "contact-form" : undefined}
      className={`hok-cform hok-cform--${variant}`}
      onSubmit={submit}
      noValidate
    >
      <div className="hok-cform__head">
        <h2 className="hok-cform__title" id={headingId} data-reveal={variant === "page" ? "mask" : undefined}>
          <MaskText text="Tell Us About" em="Your Brand" />
        </h2>
        {variant === "page" && <p className="hok-cform__sub">Share a few details and we’ll reply within one working day.</p>}
      </div>

      <div className="hok-cform__row">
        {field("name", "Name", "text", { autoComplete: "name", inputMode: "text" })}
        {field("email", "Email", "email", { autoComplete: "email", inputMode: "email" })}
      </div>
      <div className="hok-cform__row">
        {field("phone", "Phone (optional)", "tel", { autoComplete: "tel", inputMode: "tel" })}
        {field("brand", "Brand / company", "text", { autoComplete: "organization", inputMode: "text" })}
      </div>
      {field("website", "Website or Instagram (optional)", "text", { autoComplete: "url", inputMode: "url" })}
      <div className={`hok-field hok-field--area${errors.message ? " has-error" : ""}`}>
        <textarea
          ref={area}
          id={messageId}
          name="message"
          rows={variant === "modal" ? 4 : 5}
          placeholder=" "
          value={values.message}
          onChange={(e) => setField("message", e.target.value)}
          onBlur={() => blur("message")}
          aria-invalid={errors.message ? true : undefined}
          aria-describedby={errors.message ? `${messageId}-err` : undefined}
        />
        <label htmlFor={messageId}>Message</label>
        {errors.message && (
          <p className="hok-error" id={`${messageId}-err`}>
            {errors.message}
          </p>
        )}
      </div>

      <div className="hok-cform__submit">
        <Btn type="submit" className={`hok-btn--block${state === "sending" ? " is-sending" : ""}`}>
          {state === "sending" ? (
            <>
              <span className="hok-spinner" aria-hidden="true" />
              Sending
            </>
          ) : (
            "Send Message"
          )}
        </Btn>
        <p className="hok-cform__note">By sending this you agree to be contacted about your enquiry.</p>
      </div>
    </form>
  );
}
