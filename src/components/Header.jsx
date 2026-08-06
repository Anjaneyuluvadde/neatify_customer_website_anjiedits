import React, { useState, useMemo, useEffect, useRef } from "react";

import { useNavigate, useLocation, Link } from "react-router-dom";
import { supabase } from "./supabaseClient";
import { FiSearch, FiX, FiUser, FiChevronRight, FiChevronDown } from "react-icons/fi";
import "./Header.css";

const POPULAR_SUGGESTIONS = [
  "Deep Cleaning",
  "Kitchen Cleaning",
  "Bathroom Cleaning",
  "Balcony Cleaning"
];

export default function Header({
  searchText: propSearchText,
  setSearchText: propSetSearchText,
  user,
  allServices = []
}) {

  const navigate = useNavigate();
  const location = useLocation();

  // Handle optional search props for standalone use on other pages
  const [internalSearchText, setInternalSearchText] = useState("");
  const searchText = propSearchText !== undefined ? propSearchText : internalSearchText;
  const setSearchText = propSetSearchText || setInternalSearchText;

  const filteredLiveResults = useMemo(() => {
    const term = searchText.trim().toLowerCase();
    if (!term) return [];
    return allServices
      .filter((s) => {
        return (
          s.title?.toLowerCase().includes(term) ||
          s.description?.toLowerCase().includes(term) ||
          (s.category || s.service_type)?.toLowerCase().includes(term)
        );
      })
      .slice(0, 10);
  }, [allServices, searchText]);

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [downloadModalOpen, setDownloadModalOpen] = useState(false);

  const userMenuRef = useRef(null);

  useEffect(() => {
    const handleClick = (event) => {
      // Close dropdown if clicking outside the menu
      if (dropdownOpen && userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [dropdownOpen]);

  const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.theneatifyteam.app";

  const handleProfile = () => {
    setDropdownOpen(false);
    navigate("/profile");
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setDropdownOpen(false);
    navigate("/login");
  };

  const goHome = () => {
    navigate("/", { replace: false });
  };

  const goServices = () => {
    const scrollToServices = () => {
      const section = document.getElementById("services-section");
      section?.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    if (location.pathname === "/services") {
      scrollToServices();
    } else {
      navigate("/services", { replace: false });
      setTimeout(scrollToServices, 300);
    }
  };

  const goFAQs = () => {
    if (location.pathname === "/services") {
      document.getElementById("faq-section")?.scrollIntoView({ block: "start", behavior: "smooth" });
    } else {
      navigate("/services", { state: { scrollToFAQs: true } });
    }
  };

  const renderUserIcon = () => {
    if (!user) return <FiUser size={18} />;

    const email = user.email || "";
    const firstLetter = email.charAt(0).toUpperCase();
    
    if (firstLetter) {
      return <span style={{ fontSize: '18px', fontWeight: '700', color: '#020617', lineHeight: '1' }}>{firstLetter}</span>;
    }

    return <FiUser size={18} />;
  };

  return (
    <>
      <header className="header">
        <div className="header-top">
          <div className="header-left">
            <img
              src="/The Neatify Team Original logo no bg closup.png"
              alt="The Neatify Team"
              className="logo"
              onClick={goHome}
            />

            <nav className="nav-links desktop-only">
              <Link to="/" className="nav-link">Home</Link>
              <span onClick={goServices} className="nav-link" style={{ cursor: 'pointer' }}>Services</span>
              <a href="#contact" className="nav-link">Contact</a>
              <button onClick={() => setHelpOpen(true)} className="nav-link-btn">Help</button>
              <button onClick={goFAQs} className="nav-link-btn">FAQs</button>
            </nav>
          </div>



          <div className="header-icons">
            {/* DESKTOP SEARCH */}
            <div className="search-wrapper desktop-only">
              <FiSearch size={16} />
              <input
                type="text"
                placeholder="Search for services..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                onFocus={() => { }}
                onBlur={() => { }}
              />
              {searchText && (
                <button onClick={() => setSearchText("")} className="clear-btn-search">
                  <FiX size={14} />
                </button>
              )}

              {/* DESKTOP SEARCH DROPDOWN */}
              {searchText.trim() && (
                <div className="search-dropdown-desktop">
                  {filteredLiveResults.length > 0 ? (
                    filteredLiveResults.map((s) => (
                      <div
                        key={s.id}
                        className="search-dropdown-item"
                        onClick={() => {
                          setSearchText(s.title);
                          goServices();
                        }}
                      >
                        <FiSearch size={14} style={{ marginRight: '10px', color: '#9ca3af' }} />
                        <span>{s.title}</span>
                        <FiChevronRight size={14} style={{ marginLeft: 'auto', color: '#9ca3af' }} />
                      </div>
                    ))
                  ) : (
                    <div className="search-no-results">
                      No services found for "{searchText}"
                    </div>
                  )}
                </div>
              )}
            </div>
            {/* MOBILE SEARCH ICON */}
            {!mobileSearchOpen && (
              <button
                className="mobile-search-icon"
                onClick={() => setMobileSearchOpen(true)}
              >
                <FiSearch size={20} />
              </button>
            )}

            {/* MOBILE SEARCH OVERLAY */}
            {mobileSearchOpen && (
              <div className="mobile-search-open">
                <div className="search-wrapper" style={{ width: '100%', maxWidth: 'none' }}>
                  <FiSearch size={18} />
                  <input
                    type="text"
                    placeholder="Search services..."
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        setMobileSearchOpen(false);
                      }
                    }}
                    autoFocus
                  />
                  <button
                    onClick={() => {
                      if (searchText) {
                        setSearchText("");
                      } else {
                        setMobileSearchOpen(false);
                      }
                    }}
                  >
                    <FiX size={18} />
                  </button>
                </div>

                <div className="search-suggestions">
                  {!searchText.trim() ? (
                    <>
                      <h3>Popular Searches</h3>
                      <div className="suggestion-chips">
                        {POPULAR_SUGGESTIONS.map((suggestion, idx) => (
                          <div
                            key={idx}
                            className="suggestion-chip"
                            onClick={() => setSearchText(suggestion)}
                          >
                            {suggestion}
                          </div>
                        ))}
                      </div>
                    </>
                  ) : filteredLiveResults.length > 0 ? (
                    <>
                      <h3>Search Results</h3>
                      <div className="search-results-list">
                        {filteredLiveResults.map((s) => (
                          <div
                            key={s.id}
                            className="search-result-item"
                            onClick={() => {
                              setMobileSearchOpen(false);
                              navigate(`/service/${s.id}`, {
                                state: { service: s, allServices },
                              });
                            }}
                          >
                            <span className="result-title">{s.title}</span>
                            <FiChevronRight size={18} color="#9ca3af" />
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="no-results-mobile">
                      <p>No services found matching "{searchText}"</p>
                    </div>
                  )}
                </div>

                <button
                  className="my-bookings-btn"
                  style={{ width: "100%", marginTop: "auto", marginBottom: "20px" }}
                  onClick={() => {
                    setMobileSearchOpen(false);
                    goServices();
                  }}
                >
                  Show Results
                </button>
              </div>
            )}

            <button
              onClick={() => setDownloadModalOpen(true)}
              className="my-bookings-btn desktop-only"
            >
              Download
            </button>

            {
              user ? (
                <>
                  <button
                    className="my-bookings-btn desktop-only"
                    onClick={() => navigate("/my-bookings")}
                  >
                    My Bookings
                  </button>

                  <div className="user-menu" ref={userMenuRef}>
                    <div
                      className="user-profile-trigger"
                      onClick={() => setDropdownOpen(!dropdownOpen)}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
                    >
                      <div className="user-circle">
                        {renderUserIcon()}
                      </div>
                      <FiChevronDown size={16} color="#4b5563" />
                    </div>

                    {dropdownOpen && (
                      <div className="dropdown" style={{ minWidth: '240px', padding: '0' }}>
                        <div style={{ padding: '16px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: '#f9fafb', borderTopLeftRadius: '12px', borderTopRightRadius: '12px' }}>
                          <div className="user-circle" style={{ width: '40px', height: '40px', flexShrink: 0 }}>
                            {renderUserIcon()}
                          </div>
                          <div style={{ overflow: 'hidden' }}>
                            <div style={{ fontWeight: '600', fontSize: '15px', color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {user.user_metadata?.full_name || user.user_metadata?.display_name || "User"}
                            </div>
                            <div style={{ fontSize: '13px', color: '#6b7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '2px' }}>
                              {user.email}
                            </div>
                          </div>
                        </div>
                        <p onClick={handleProfile} style={{ padding: '12px 16px' }}>Profile</p>
                        <p onClick={() => navigate("/my-bookings")} style={{ padding: '12px 16px' }}>
                          My Bookings
                        </p>
                        <p onClick={handleLogout} style={{ padding: '12px 16px', borderTop: '1px solid #f3f4f6', color: '#dc2626' }}>Logout</p>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <button
                  className="my-bookings-btn"
                  onClick={() => navigate("/login")}
                >
                  Login
                </button>
              )
            }

            <button
              className="mobile-menu-toggle"
              onClick={() => setMobileMenuOpen(true)}
            >
              ☰
            </button>
          </div >
        </div >
      </header >

      {/* ✅ MOBILE SIDEBAR */}
      {
        mobileMenuOpen && (
          <div className="mobile-menu-overlay" onClick={() => setMobileMenuOpen(false)}>
            <div className="mobile-menu-drawer" onClick={(e) => e.stopPropagation()}>
              <div className="mobile-menu-header">
                <img src="/The Neatify Team Original logo no bg closup.png" alt="The Neatify Team" className="logo" style={{ height: '32px' }} />
                <button
                  className="close-btn"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  ✕
                </button>
              </div>

              <div className="mobile-links">
                <div className="mobile-link-item" onClick={() => { goHome(); setMobileMenuOpen(false); }}>
                  Home
                </div>

                <div className="mobile-link-item" onClick={() => { goServices(); setMobileMenuOpen(false); }}>
                  Services
                </div>

                <div className="mobile-link-item download-item" onClick={() => { setDownloadModalOpen(true); setMobileMenuOpen(false); }}>
                  Download App
                </div>

                <div
                  className="mobile-link-item"
                  onClick={() => {
                    document
                      .getElementById("contact")
                      ?.scrollIntoView({ behavior: "smooth" });
                    setMobileMenuOpen(false);
                  }}
                >
                  Contact
                </div>

                <div className="mobile-link-item" onClick={() => { setHelpOpen(true); setMobileMenuOpen(false); }}>
                  Help
                </div>

                <div className="mobile-link-item" onClick={() => { goFAQs(); setMobileMenuOpen(false); }}>
                  FAQs
                </div>

                {user ? (
                  <>
                    <div className="mobile-link-item" onClick={() => { navigate("/profile"); setMobileMenuOpen(false); }}>
                      Profile
                    </div>
                    <div className="mobile-link-item" onClick={() => { navigate("/my-bookings"); setMobileMenuOpen(false); }}>
                      My Bookings
                    </div>
                    <div className="mobile-link-item logout" onClick={() => { handleLogout(); setMobileMenuOpen(false); }}>
                      Logout
                    </div>
                  </>
                ) : (
                  <div className="mobile-link-item" onClick={() => { navigate("/login"); setMobileMenuOpen(false); }}>
                    Login
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      }

      {/* ✅ HELP MODAL */}
      {
        helpOpen && (
          <div className="help-overlay" onClick={() => setHelpOpen(false)}>
            <div className="help-modal" onClick={(e) => e.stopPropagation()}>
              <button className="help-close" onClick={() => setHelpOpen(false)}>
                ✕
              </button>
              <h2 style={{ marginBottom: "20px", color: "#f4c430" }}>Need Help?</h2>
              <p style={{ fontSize: "16px", marginBottom: "15px" }}>
                Our support team is available 24/7. Feel free to call us for any assistance.
              </p>
              <div
                style={{
                  background: "#f9fafb",
                  padding: "15px",
                  borderRadius: "10px",
                  marginBottom: "20px",
                }}
              >
                <p style={{ fontWeight: "600", fontSize: "18px" }}>Call us at:</p>
                <a
                  href="tel:+917617618567"
                  style={{
                    fontSize: "20px",
                    color: "#000",
                    textDecoration: "underline",
                  }}
                >
                  +91 7617618567
                </a>
              </div>
              <button
                className="my-bookings-btn"
                style={{ width: "100%", marginTop: "20px" }}
                onClick={() => setHelpOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        )
      }

      {/* ✅ DOWNLOAD MODAL */}
      {
        downloadModalOpen && (
          <div className="download-overlay" onClick={() => setDownloadModalOpen(false)}>
            <div className="download-modal" onClick={(e) => e.stopPropagation()}>
              <button className="download-close" onClick={() => setDownloadModalOpen(false)}>
                ✕
              </button>
              <h2 className="download-title">Download The Neatify Team App</h2>
              <p className="download-subtitle">
                Experience the best cleaning services from your smartphone.
              </p>

              <div className="download-options">
                {/* PLAY STORE */}
                <a
                  href={PLAY_STORE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="download-btn google-play"
                >
                  <img src="/google-play_3128279.png" alt="" />
                  <span>Get it on Google Play Store</span>
                </a>

                {/* APP STORE */}
                <button
                  className="download-btn app-store disabled"
                  disabled
                >
                  <img src="/apple.png" alt="" />
                  <span>Coming Soon on App Store</span>
                </button>
              </div>

              <div className="qr-section">
                <div className="qr-container">
                  <p className="qr-label">Scan to Download</p>
                  <div className="qr-box">
                    <img
                      src="/The Neatify Team App Playstore QR-Code.png"
                      alt="Play Store QR Code"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      }

    </>
  );
}