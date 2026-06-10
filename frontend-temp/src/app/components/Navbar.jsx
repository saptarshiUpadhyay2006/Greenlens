'use client'
import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import Lenis from 'lenis'
import { useUser } from '@clerk/nextjs'
import { Menu, X } from 'lucide-react'

export default function Navbar() {
  const { isSignedIn } = useUser()
  const [activeSection, setActiveSection] = useState('#hero')
  const [isOpen, setIsOpen] = useState(false)

  const leftNavItems = [
    { name: 'About', href: '#about' },
    { name: 'Our Impact', href: '#impact' },
  ]

  const rightNavItems = [
    { name: 'How It Works', href: '#how-it-works' },
    { name: 'Connect', href: '#connect' },
  ]

  // Initialize Lenis once for smooth scrolling
  useEffect(() => {
    let lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    })

    // Update active section on scroll
    const handleScroll = () => {
      const sections = document.querySelectorAll('section[id]')
      let current = '#hero'
      const scrollPos = window.scrollY + window.innerHeight / 2

      sections.forEach((section) => {
        const top = section.offsetTop
        const height = section.offsetHeight
        if (scrollPos >= top && scrollPos < top + height) {
          current = `#${section.id}`
        }
      })

      setActiveSection(current)
    }

    window.addEventListener('scroll', handleScroll)
    handleScroll()

    return () => {
      window.removeEventListener('scroll', handleScroll)
      lenis.destroy()
    }
  }, [])

  // Smooth scroll on click
  const handleClick = (e, href) => {
    e.preventDefault()
    const target = document.querySelector(href)
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  const handleMobileClick = (e, href) => {
    handleClick(e, href)
    setIsOpen(false)
  }

  return (
    <>
      {/* Desktop Navbar (Large Screens) */}
      <motion.nav 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className='fixed top-4 left-1/2 -translate-x-1/2 z-50 
                   bg-white/20 backdrop-blur-xl border border-white/30 
                   rounded-full shadow-lg px-8 py-3 hidden md:flex items-center 
                   justify-center space-x-8'
      >
        {/* Left Nav Items */}
        <div className='flex space-x-6'>
          {leftNavItems.map((item, i) => (
            <a
              key={i}
              href={item.href}
              onClick={(e) => handleClick(e, item.href)}
              className={`font-semibold text-base transition-all duration-300 hover:text-[#2E7D32] hover:scale-105 ${
                activeSection === item.href ? 'text-[#2E7D32]' : 'text-[#1B5E20]'
              }`}
            >
              {item.name}
            </a>
          ))}
        </div>

        {/* Center Logo */}
        <Link href="/home" className='mx-6 shrink-0'>
          <img
            src="/greenlens_logo.svg"
            alt="GreenLens"
            className="h-12 w-12 hover:scale-110 transition-transform duration-300 cursor-pointer drop-shadow-sm"
          />
        </Link>

        {/* Right Nav Items + CTA */}
        <div className='flex items-center space-x-6'>
          {rightNavItems.map((item, i) => (
            <a
              key={i}
              href={item.href}
              onClick={(e) => handleClick(e, item.href)}
              className={`font-semibold text-base transition-all duration-300 hover:text-[#2E7D32] hover:scale-105 ${
                activeSection === item.href ? 'text-[#2E7D32]' : 'text-[#1B5E20]'
              }`}
            >
              {item.name}
            </a>
          ))}

          {/* Login / Signup Button */}
          <Link
            href={isSignedIn ? "/home" : "/auth"}
            className='bg-[#1B5E20] text-[#E8F5E9] font-semibold text-base px-5 py-2.5 rounded-full shadow-md transition-all duration-300 hover:bg-[#2E7D32] hover:scale-105 shrink-0'
          >
            {isSignedIn ? "Dashboard" : "Login"}
          </Link>
        </div>
      </motion.nav>

      {/* Mobile Navbar (Small Screens) */}
      <motion.nav
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className='fixed top-4 left-4 right-4 z-50 
                   bg-white/40 backdrop-blur-xl border border-white/40 
                   rounded-full shadow-lg px-6 py-2.5 flex md:hidden items-center 
                   justify-between'
      >
        {/* Left Logo */}
        <Link href="/home" className='flex items-center gap-2 shrink-0'>
          <img
            src="/greenlens_logo.svg"
            alt="GreenLens"
            className="h-10 w-10 cursor-pointer drop-shadow-sm"
          />
          <span className="font-extrabold text-emerald-950 text-base tracking-tight">GreenLens</span>
        </Link>

        <div className="flex items-center gap-3">
          {/* Quick CTA */}
          <Link
            href={isSignedIn ? "/home" : "/auth"}
            className='bg-[#1B5E20] text-[#E8F5E9] font-bold text-xs px-4 py-2 rounded-full shadow-md hover:bg-[#2E7D32] shrink-0'
          >
            {isSignedIn ? "Dashboard" : "Login"}
          </Link>

          {/* Hamburger Menu Toggle */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="p-1.5 rounded-full bg-emerald-50 border border-emerald-100 text-[#1B5E20] hover:bg-emerald-100 transition-colors shrink-0"
            aria-label="Toggle Menu"
          >
            {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </motion.nav>

      {/* Mobile Menu Overlay Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="fixed top-20 left-4 right-4 z-40 md:hidden 
                       bg-white/95 backdrop-blur-2xl border border-emerald-100/50
                       rounded-3xl shadow-xl p-6 flex flex-col space-y-4"
          >
            {/* Vertically Stacked Links */}
            {[...leftNavItems, ...rightNavItems].map((item, i) => (
              <a
                key={i}
                href={item.href}
                onClick={(e) => handleMobileClick(e, item.href)}
                className={`font-semibold text-lg py-3 border-b border-emerald-50/50 transition-all duration-300 ${
                  activeSection === item.href ? 'text-[#2E7D32]' : 'text-[#1B5E20]'
                }`}
              >
                {item.name}
              </a>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
