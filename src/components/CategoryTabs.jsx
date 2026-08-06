import React, { useRef, useState, useEffect } from "react";
import { NavLink } from "react-router-dom";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";
import "./CategoryTabs.css";

export default function CategoryTabs({
  activeTab,
  onChange,
  tabs = [], 
}) {
  const scrollRef = useRef(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);

  const checkScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setShowLeftArrow(scrollLeft > 10);
      setShowRightArrow(scrollLeft + clientWidth < scrollWidth - 10);
    }
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener("resize", checkScroll);
    return () => window.removeEventListener("resize", checkScroll);
  }, [tabs]);

  const scroll = (direction) => {
    if (scrollRef.current) {
      const scrollAmount = 300;
      scrollRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  return (
    <div className="tabs-wrapper">
      <div className="tabs-scroll-outer">
        {showLeftArrow && (
          <button className="scroll-btn left" onClick={() => scroll("left")}>
            <FiChevronLeft />
          </button>
        )}
        
        <div 
          className="tabs-container" 
          ref={scrollRef}
          onScroll={checkScroll}
        >
          {tabs.map((tab) => {
            return (
              <NavLink
                key={tab.value}
                to={tab.link}
                state={{ preventScroll: true }}
                end={tab.value === "ALL"}
                className={({ isActive: rrActive }) => {
                  const normalize = (str) => str?.toString().toUpperCase().replace(/[\s_]+/g, "").trim();
                  return `tab-dock-item ${normalize(tab.value) === normalize(activeTab) ? "active" : ""}`;
                }}
                onClick={() => {
                  onChange(tab.value);
                }}
              >
                <span className="tab-dock-label">
                  {tab.label}
                </span>
              </NavLink>
            );
          })}
        </div>

        {showRightArrow && (
          <button className="scroll-btn right" onClick={() => scroll("right")}>
            <FiChevronRight />
          </button>
        )}
      </div>
    </div>
  );
}
