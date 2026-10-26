import React from 'react';
import './AppLoader.css';

export const AppLoader: React.FC = () => {
    return (
        <div className="app-loader-container">
            <div className="shimmer-app-layout">
                {/* Simulated Sidebar */}
                <div className="shimmer-sidebar">
                    <div className="shimmer-block shimmer-title"></div>
                    <div className="shimmer-block shimmer-item"></div>
                    <div className="shimmer-block shimmer-item delay-1"></div>
                    <div className="shimmer-block shimmer-item delay-2"></div>
                </div>

                {/* Simulated Main Content Area */}
                <div className="shimmer-main">
                    {/* Simulated Header */}
                    <div className="shimmer-header">
                        <div className="shimmer-block shimmer-title-short"></div>
                        <div className="shimmer-block shimmer-button"></div>
                    </div>

                    {/* Simulated Config Bar */}
                    <div className="shimmer-config">
                        <div className="shimmer-block shimmer-line delay-1"></div>
                        <div className="shimmer-block shimmer-line delay-2"></div>
                        <div className="shimmer-block shimmer-line delay-3"></div>
                    </div>

                    {/* Simulated Empty Schedule Canvas */}
                    <div className="shimmer-content">
                        <div className="shimmer-hero-card">
                            <div className="shimmer-block shimmer-circle"></div>
                            <div className="shimmer-block shimmer-hero-title delay-1"></div>
                            <div className="shimmer-block shimmer-hero-line delay-2"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
