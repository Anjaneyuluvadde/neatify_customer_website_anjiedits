import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from './Toast/ToastContext';
import usePromotionalBanners from '../hooks/usePromotionalBanners';
import BannerServiceModal from './BannerServiceModal';

export default function PromotionalBanners({ user }) {
  const { banners, loading } = usePromotionalBanners(user);
  const [activeBanner, setActiveBanner] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const navigate = useNavigate();
  const toast = useToast();

  const applyClaim = (banner, serviceId = null) => {
    const claimType = (banner.customer_type === "new" || banner.customer_type === "new_user") 
      ? "NEW_USER" 
      : "PROMOTIONAL_BANNER";

    const claimObject = {
      type: claimType,
      bannerId: banner.id,
      offerPercentage: banner.offer_percentage,
      claimedAt: new Date().toISOString(),
      serviceId: serviceId || null,
    };

    sessionStorage.setItem("claimedOffer", JSON.stringify(claimObject));

    if (!user) {
      navigate("/signup");
    } else if (serviceId) {
      toast.success(`Offer Applied! ${banner.offer_percentage}% discount is ready for your booking.`);
      navigate(`/service/${serviceId}`);
    } else {
      toast.success(`Offer Applied! ${banner.offer_percentage}% discount is ready for your booking.`);
      const servicesSection = document.getElementById("services-section");
      if (servicesSection) {
        servicesSection.scrollIntoView({ behavior: "smooth" });
      }
    }
  };

  const handleBannerClick = (banner) => {
    if (banner.service_ids && banner.service_ids.length > 0) {
      setActiveBanner(banner);
    } else {
      applyClaim(banner);
    }
  };

  const handleServiceSelect = (service) => {
    setActiveBanner(null); // Close modal
    applyClaim(activeBanner, service.id);
  };

  useEffect(() => {
    if (banners.length <= 1) return;
    
    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % banners.length);
    }, 4000); // Slide every 4 seconds
    
    return () => clearInterval(interval);
  }, [banners.length]);

  if (loading || banners.length === 0) {
    return null;
  }

  return (
    <>
      <div className="promotional-slider-wrapper">
        <div 
          className="promotional-banners-track"
          style={{ transform: `translateX(-${currentIndex * 100}%)` }}
        >
          {banners.map((banner) => (
            <div 
              key={banner.id} 
              className="promotional-banner-item"
              onClick={() => handleBannerClick(banner)}
            >
              <img 
                src={banner.image_url} 
                alt={banner.title || "Promotional Banner"} 
                className="promotional-banner-image"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            </div>
          ))}
        </div>

        {banners.length > 1 && (
          <div className="promotional-slider-dots">
            {banners.map((_, idx) => (
              <span 
                key={idx} 
                className={`slider-dot ${idx === currentIndex ? 'active' : ''}`}
                onClick={() => setCurrentIndex(idx)}
              />
            ))}
          </div>
        )}
      </div>

      {activeBanner && (
        <BannerServiceModal 
          banner={activeBanner}
          onClose={() => setActiveBanner(null)}
          onServiceSelect={handleServiceSelect}
        />
      )}
    </>
  );
}
