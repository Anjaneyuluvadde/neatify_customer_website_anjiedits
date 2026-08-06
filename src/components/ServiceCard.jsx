import React, { useRef, useState, useEffect } from "react";

import "../Services.css";
import "./ServiceCard.css";

const getCurrency = (value) => {
  if (!value) return "₹"; // Fallback
  const match = String(value).match(/^([^\d\s]+)/);
  return match ? match[1] : "₹";
};

export default function ServiceCard({ service, onView, onBookNow, scrollDirection, cornerIcon }) {
  const cardRef = useRef(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const currentCard = cardRef.current;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(entry.target);
        }
      },
      {
        threshold: 0.1,
        rootMargin: "-10% 0px -10% 0px", // Trigger earlier/later to see it "all the time"
      }
    );

    if (currentCard) {
      observer.observe(currentCard);
    }

    return () => {
      if (currentCard) {
        observer.unobserve(currentCard);
      }
    };
  }, []);

  const handleMouseMove = (e) => {
    if (!cardRef.current || !isVisible) return;

    const card = cardRef.current;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    // Correcting formulas to ensure the hovered part sinks IN
    const rotateX = ((centerY - y) / centerY) * 6; // Max 6 deg
    const rotateY = ((x - centerX) / centerX) * 6; // Max 6 deg

    setTilt({ x: rotateX, y: rotateY });
  };

  const handleMouseLeave = () => {
    setTilt({ x: 0, y: 0 });
  };

  return (
    <div
      className={`service-card ${isVisible ? "revealed" : ""} ${(!isVisible && scrollDirection === "up") ? "no-blur-transition" : ""}`}
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={() => onView(service.slug)}
      style={{
        transform: `perspective(1000px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) scale(${tilt.x !== 0 || tilt.y !== 0 ? 0.99 : 1})`,
        transition: tilt.x === 0 && tilt.y === 0 ? "all 1.75s cubic-bezier(0.23, 1, 0.32, 1)" : "transform 0.1s ease-out"
      }}
    >
      {service.image && (
        <img
          src={service.image}
          alt={service.title}
          className="service-card-image"
          loading="lazy"
        />
      )}

      {cornerIcon && (
        <div className="card-corner-decor">
          <img src={cornerIcon} alt="Decor" />
        </div>
      )}

      <div className="service-card-content">
        <h3 className="service-title">{service.title}</h3>

        {service.duration && (
          <p className="service-duration">{service.duration}</p>
        )}

        <div className="service-price-row">
          {service.original_price && (
            <span className="mrp">{getCurrency(service.original_price)}{String(service.original_price).replace(/^[^\d\s]+\s*/, "")}</span>
          )}

          <span className="offer-price">
            {getCurrency(service.price)}{String(service.price).replace(/^[^\d\s]+\s*/, "")}
          </span>

          {(service.discount_label || (service.discount_percent > 0) || service.original_price) && (
            <span className="offer-badge-premium">
              {service.discount_label || (service.discount_percent > 0 ? `${service.discount_percent}% OFF` : "SPECIAL OFFER")}
            </span>
          )}
        </div>

        <div className="actions">
          {/* View Service */}
          <button
            type="button"
            className="view-service-btn"
            onClick={(e) => {
              e.stopPropagation();
              onView(service.slug);
            }}
          >
            View Service
          </button>

          {/* Book Now */}
          {onBookNow && (
            <button
              type="button"
              className="book-now-btn"
              onClick={(e) => {
                e.stopPropagation();
                onBookNow(service.slug);
              }}
            >
              Book Now
            </button>
          )}
        </div>
      </div>
    </div>
  );
}