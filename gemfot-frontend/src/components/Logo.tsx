

import { Link } from 'react-router-dom';
import React from 'react';

export const Logo: React.FC = () => {
    return (
        <Link to="/" className="flex items-center space-x-2 group">
            <div className="flex items-center justify-center p-1 overflow-hidden shadow-lg group-hover:scale-105 transition-transform duration-500">
                <img src="/logo.svg" alt='emelverse logo' className='w-14 h-8 object-cover' />
            </div>
            <span className="text-white text-xl font-raleway font-bold">mlswap </span>
        </Link>
    );
};

