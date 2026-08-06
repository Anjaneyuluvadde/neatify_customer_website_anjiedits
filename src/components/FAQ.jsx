import React, { useState } from "react";
import { FiPlus, FiMinus, FiChevronUp } from "react-icons/fi";
import { supabase } from "./supabaseClient";
import "./FAQ.css";

export default function FAQ() {
  const faqs = [
    {
      id: 1,
      question: "What is Neatify?",
      answer: "Neatify is a one-stop app and website for premium home services like professional cleaning, appliance repair, pest control, and personal care."
    },
    {
      id: 2,
      question: "How do I book a service?",
      answer: "You can book a service in seconds. Simply choose the service category, select the specific service package, choose your preferred date and time, and securely complete your payment."
    },
    {
      id: 3,
      question: "How much will it cost?",
      answer: "We believe in transparent pricing. The cost depends on the service type and property details. You can view the exact rates and applicable discounts for each service before you click book."
    },
    {
      id: 4,
      question: "Are the service providers verified?",
      answer: "Yes, absolute safety and quality are our priorities. Every professional on The Neatify Team goes through background verification, safety audits, and professional training."
    },
    {
      id: 5,
      question: "Where is Neatify available?",
      answer: "We currently provide home services across Hyderabad, including Pragathi Nagar, Bachupally, Kukatpally, and surrounding areas."
    }
  ];

  const [activeId, setActiveId] = useState(1);

  const activeFAQ = faqs.find((f) => f.id === activeId) || faqs[0];
  const inactiveFAQs = faqs.filter((f) => f.id !== activeId);

  const { data } = supabase.storage
    .from("category-icons")
    .getPublicUrl("FAQs image.png");
  const cleanerImgUrl = data?.publicUrl || "/assets/cleaner_faq.png";

  return (
    <section className="faq-section" id="faq-section">
      <div className="faq-layout-container">
        {/* Left Side: Cleaner Image */}
        <div className="faq-image-side">
          <img 
            src={cleanerImgUrl} 
            alt="Neatify Professional Cleaner" 
            className="faq-cleaner-img" 
          />
        </div>

        {/* Right Side: FAQs */}
        <div className="faq-content-side">
          <div className="faq-header">
            <span className="faq-badge">FAQs</span>
            <h2 className="faq-title">
              Frequently Asked <span className="faq-highlight">Questions</span>
            </h2>
            <p className="faq-subtitle">
              Find answers to common questions about our home services.
            </p>
          </div>

          <div className="faq-content">
            {/* Active FAQ Card */}
            <div className="faq-active-card">
              <div className="faq-active-header">
                <div className="faq-active-left">
                  <span className="faq-active-icon">
                    <FiMinus size={14} />
                  </span>
                  <h3 className="faq-active-question">{activeFAQ.question}</h3>
                </div>
                <span className="faq-active-chevron-wrapper">
                  <FiChevronUp className="faq-active-chevron" size={18} />
                </span>
              </div>
              <div className="faq-active-body">
                <p className="faq-active-text">{activeFAQ.answer}</p>
              </div>
            </div>

            {/* Inactive FAQ Grid */}
            <div className="faq-grid">
              {inactiveFAQs.map((faq) => (
                <div
                  key={faq.id}
                  className="faq-grid-card"
                  onClick={() => setActiveId(faq.id)}
                >
                  <span className="faq-grid-question">{faq.question}</span>
                  <span className="faq-grid-icon">
                    <FiPlus size={16} />
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
