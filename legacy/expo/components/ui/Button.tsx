import React, { forwardRef } from "react";
import { Pressable, type PressableProps, View, ActivityIndicator } from "react-native";
import { cn } from "../../lib/utils";
import { AppText } from "../AppText";

export interface ButtonProps extends PressableProps {
  variant?: "default" | "secondary" | "outline" | "ghost" | "destructive";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  textClassName?: string;
  loading?: boolean;
  children: React.ReactNode;
}

const Button = forwardRef<React.ElementRef<typeof Pressable>, ButtonProps>(
  ({ className, variant = "default", size = "default", textClassName, loading, children, disabled, ...props }, ref) => {
    const isGhost = variant === "ghost";
    const isOutline = variant === "outline";
    const isSecondary = variant === "secondary";
    const isDestructive = variant === "destructive";

    return (
      <Pressable
        ref={ref}
        className={cn(
          "flex-row items-center justify-center rounded-xl",
          size === "default" && "h-14 px-6 py-3",
          size === "sm" && "h-10 px-4",
          size === "lg" && "h-16 px-8",
          size === "icon" && "h-14 w-14",
          variant === "default" && "bg-primary-600 active:bg-primary-700",
          isSecondary && "bg-surface-100 active:bg-surface-200",
          isOutline && "border border-surface-300 bg-white active:bg-surface-50",
          isGhost && "active:bg-surface-100",
          isDestructive && "bg-red-500 active:bg-red-600",
          (disabled || loading) && "opacity-50",
          className,
        )}
        disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <ActivityIndicator
            color={variant === "default" || variant === "destructive" ? "white" : "#D85A30"}
            style={{ marginRight: 8 }}
          />
        )}
        {React.Children.map(children, (child) => {
          if (typeof child === "string" || typeof child === "number") {
            return (
              <AppText
                className={cn(
                  "font-semibold text-base",
                  size === "lg" && "text-lg",
                  size === "sm" && "text-sm text-center",
                  variant === "default" && "text-white",
                  isSecondary && "text-surface-900",
                  isOutline && "text-surface-900",
                  isGhost && "text-surface-900",
                  isDestructive && "text-white",
                  textClassName,
                )}
              >
                {child}
              </AppText>
            );
          }
          return child;
        })}
      </Pressable>
    );
  },
);

Button.displayName = "Button";

export { Button };
