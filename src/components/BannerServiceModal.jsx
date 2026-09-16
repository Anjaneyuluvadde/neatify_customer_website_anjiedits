import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import '../Services.css'; // ensure we get the modal styles

export default function BannerServiceModal({ banner, onClose, onServiceSelect }) {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchServices() {
      if (!banner || !banner.service_ids || banner.service_ids.length === 0) {
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("services")
          .select("id, title, image")
          .in("id", banner.service_ids);

        if (error) throw error;
        setServices(data || []);
      } catch (err) {
        console.error("Error fetching banner services:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchServices();
  }, [banner]);

  if (!banner) return null;

  return (
    <div className="cleaning-modal-backdrop" onClick={onClose} style={{ zIndex: 99999 }}>
      <div 
        className="cleaning-modal-container" 
        onClick={(e) => e.stopPropagation()} 
        style={{ maxWidth: '600px', margin: '40px auto', display: 'flex', flexDirection: 'column', maxHeight: '80vh', position: 'relative', top: '10%' }}
      >
        <div className="cleaning-modal-header">
          <h2>Select a Service</h2>
          <button className="cleaning-modal-close" onClick={onClose}>
            &times;
          </button>
        </div>

        <div style={{ padding: '0 32px 16px', color: '#64748b', fontSize: '15px' }}>
          Apply your {banner.offer_percentage}% discount to one of the following eligible services:
        </div>

        {loading ? (
          <div style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>Loading services...</div>
        ) : services.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>No specific services available for this offer.</div>
        ) : (
          <div className="cleaning-modal-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))' }}>
            {services.map(service => (
              <div 
                key={service.id} 
                className="cleaning-modal-item"
                onClick={() => onServiceSelect(service)}
              >
                <div className="cleaning-modal-item-icon">
                  {service.image ? (
                    <img src={service.image} alt={service.title} />
                  ) : (
                    <div className="cleaning-modal-icon-placeholder" style={{ width: '60%', height: '60%', background: '#e2e8f0', borderRadius: '50%' }}></div>
                  )}
                </div>
                <div className="cleaning-modal-item-name">{service.title}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
