import React from 'react';
import './Logo.css';

const Logo = ({ size = 40, showText = true, showIcon = true }) => {
  return (
    <div className="logo-container">
      {showIcon && (
        <div className="logo-icon">
          <img 
            src="/logo.png" 
            alt="AIBuildMind Logo" 
            width={size} 
            height={size}
            className="logo-image"
          />
        </div>
      )}
      {showText && (
        <div className="logo-text">
          <span className="logo-brand">AIBuildMind</span>
        </div>
      )}
    </div>
  );
};

export default Logo;
