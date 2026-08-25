// src/components/UnifiedMessaging/ShopProductList.js
import React from 'react';

const PRODUCTS = [
  { id: '1', name: 'Ultimate Prompt Pack',     price: '₱149', seller: 'AIExplorer',    icon: '📦', rating: '4.9' },
  { id: '2', name: 'Study Notes Bundle',       price: '₱89',  seller: 'StudyBuddy',    icon: '📝', rating: '4.7' },
  { id: '3', name: 'UI Design Templates',      price: '₱299', seller: 'NoctirionVale', icon: '🎨', rating: '5.0' },
  { id: '4', name: 'React Hooks Cheatsheet',   price: 'Free', seller: 'CodeMaster',    icon: '⚛️', rating: '4.8' },
  { id: '5', name: 'Focus Sound Pack',         price: '₱79',  seller: 'ZenLabs',       icon: '🎵', rating: '4.6' },
  { id: '6', name: 'Framer Motion Kit',        price: '₱199', seller: 'MotionPH',      icon: '🎬', rating: '4.8' },
];

const ShopProductList = () => {
  return (
    <div className="um-shop-list">
      <div className="um-shop-header">
        <h4>Digital Products</h4>
        <span className="um-shop-badge um-shop-badge--soon">🚧 Coming Soon</span>
      </div>

      <div className="um-shop-comingsoon">
        <div className="um-shop-comingsoon-icon">🛍️</div>
        <h4>Marketplace launching soon</h4>
        <p>Buy and sell study templates, prompt packs, and more. Here's a preview.</p>
      </div>

      <div className="um-shop-filters" aria-disabled="true">
        <button className="um-fchip active" disabled>All</button>
        <button className="um-fchip" disabled>Templates</button>
        <button className="um-fchip" disabled>Kits</button>
        <button className="um-fchip" disabled>Free</button>
      </div>

      <div className="um-prod-grid um-prod-grid--preview">
        {PRODUCTS.map(product => (
          <div key={product.id} className="um-prod-card um-prod-card--disabled">
            <span className="um-prod-soon-tag">Soon</span>
            <div className="um-prod-thumb">{product.icon}</div>
            <div className="um-prod-body">
              <div className="um-prod-name">{product.name}</div>
              <div className="um-prod-seller">by {product.seller}</div>
              <div className="um-prod-foot">
                {product.price === 'Free'
                  ? <span className="um-prod-free">Free</span>
                  : <span className="um-prod-price">{product.price}</span>}
                <span className="um-prod-star">★ {product.rating}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ShopProductList;