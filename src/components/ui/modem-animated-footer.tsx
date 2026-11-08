"use client";

import React from "react";
import { Brain } from "lucide-react";
import { cn } from "@/lib/utils";

interface FooterLink {
  label: string;
  href: string;
}

interface SocialLink {
  icon: React.ReactNode;
  href: string;
  label: string;
}

interface FooterProps {
  brandName?: string;
  brandDescription?: string;
  socialLinks?: SocialLink[];
  navLinks?: FooterLink[];
  creatorName?: string;
  creatorUrl?: string;
  brandIcon?: React.ReactNode;
  className?: string;
}

export const Footer = ({
  brandName = "YourBrand",
  brandDescription = "Your description here",
  socialLinks = [],
  navLinks = [],
  creatorName,
  creatorUrl,
  brandIcon,
  className,
}: FooterProps) => {
  return (
    <section className={cn("hirex-footer relative w-full mt-0 overflow-hidden", className)}>
      <footer className="relative mt-20 overflow-hidden border-t border-white/20 bg-black/55 text-white">
        <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-black/45 to-black/80" />
        <div className="relative mx-auto flex min-h-[30rem] max-w-7xl flex-col justify-between p-5 py-12 sm:min-h-[35rem] sm:p-8 sm:py-14 md:min-h-[40rem]">
          <div className="flex w-full flex-col">
            <div className="w-full flex flex-col items-center">
              <div className="flex flex-1 flex-col items-center space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-3xl font-bold tracking-tight text-white">
                    {brandName}
                  </span>
                </div>
                <p className="w-full max-w-sm px-4 text-center font-medium leading-7 text-white/65 sm:w-96 sm:px-0">
                  {brandDescription}
                </p>
              </div>

              {socialLinks.length > 0 && (
                <div className="mt-6 mb-8 flex gap-3">
                  {socialLinks.map((link, index) => (
                    <a
                      key={index}
                      href={link.href}
                      className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white/65 backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:border-white/40 hover:bg-white/20 hover:text-white"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <div className="h-5 w-5">
                        {link.icon}
                      </div>
                      <span className="sr-only">{link.label}</span>
                    </a>
                  ))}
                </div>
              )}

              {navLinks.length > 0 && (
                <div className="flex flex-wrap justify-center gap-2 text-sm font-medium text-white/65">
                  {navLinks.map((link, index) => (
                    <a
                      key={index}
                      className="rounded-full border border-white/10 bg-white/[.06] px-4 py-2 transition duration-300 hover:border-white/30 hover:bg-white/15 hover:text-white"
                      href={link.href}
                    >
                      {link.label}
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="mt-20 flex flex-col items-center justify-between gap-3 border-t border-white/15 pt-5 text-center md:flex-row md:text-left">
            <p className="text-sm text-white/55">
              © {new Date().getFullYear()} {brandName}. All rights reserved.
            </p>
            {creatorName && creatorUrl && (
              <nav className="flex gap-4">
                <a
                  href={creatorUrl}
                  target="_blank"
                  className="text-sm text-white/55 transition-colors duration-300 hover:text-white"
                >
                  Crafted by {creatorName}
                </a>
              </nav>
            )}
          </div>
        </div>

        {/* Large background text */}
        <div
          className="pointer-events-none absolute bottom-40 left-1/2 -translate-x-1/2 select-none bg-gradient-to-b from-white/20 via-white/10 to-transparent bg-clip-text px-4 text-center font-extrabold leading-none tracking-tighter text-transparent md:bottom-32"
          style={{
            fontSize: 'clamp(3rem, 12vw, 10rem)',
            maxWidth: '95vw',
          }}
        >
          {brandName.toUpperCase()}
        </div>

        {/* Bottom logo */}
        <div className="absolute bottom-24 left-1/2 z-10 flex -translate-x-1/2 items-center justify-center rounded-[1.75rem] border border-white/25 bg-black/35 p-3 shadow-2xl backdrop-blur-xl transition duration-500 hover:-translate-y-2 hover:border-white/50 md:bottom-20">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/20 bg-white shadow-lg sm:h-16 sm:w-16 md:h-24 md:w-24">
            {brandIcon || (
              <Brain className="h-8 w-8 text-black drop-shadow-lg sm:h-10 sm:w-10 md:h-14 md:w-14" />
            )}
          </div>
        </div>

        {/* Bottom line */}
        <div className="absolute bottom-32 left-1/2 h-px w-full -translate-x-1/2 bg-gradient-to-r from-transparent via-white/30 to-transparent backdrop-blur-sm sm:bottom-34"></div>

        {/* Bottom shadow */}
        <div className="absolute bottom-28 h-24 w-full bg-gradient-to-t from-black via-black/70 to-transparent blur-[1em]"></div>
      </footer>
    </section>
  );
};