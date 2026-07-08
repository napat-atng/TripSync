import { forwardRef } from "react";
import { View, type ViewProps } from "react-native";
import { cn } from "../../lib/utils";
import { AppText } from "../AppText";

export interface CardProps extends ViewProps {
  className?: string;
}

const Card = forwardRef<React.ElementRef<typeof View>, CardProps>(
  ({ className, ...props }, ref) => (
    <View
      ref={ref}
      className={cn("rounded-2xl border border-surface-200 bg-white", className)}
      {...props}
    />
  ),
);
Card.displayName = "Card";

const CardHeader = forwardRef<React.ElementRef<typeof View>, ViewProps>(
  ({ className, ...props }, ref) => (
    <View ref={ref} className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />
  ),
);
CardHeader.displayName = "CardHeader";

const CardTitle = forwardRef<
  React.ElementRef<typeof AppText>,
  React.ComponentPropsWithoutRef<typeof AppText>
>(({ className, ...props }, ref) => (
  <AppText
    ref={ref}
    className={cn("font-semibold leading-none tracking-tight text-surface-950 text-xl", className)}
    {...props}
  />
));
CardTitle.displayName = "CardTitle";

const CardDescription = forwardRef<
  React.ElementRef<typeof AppText>,
  React.ComponentPropsWithoutRef<typeof AppText>
>(({ className, ...props }, ref) => (
  <AppText
    ref={ref}
    className={cn("text-sm text-surface-500", className)}
    {...props}
  />
));
CardDescription.displayName = "CardDescription";

const CardContent = forwardRef<React.ElementRef<typeof View>, ViewProps>(
  ({ className, ...props }, ref) => (
    <View ref={ref} className={cn("p-6 pt-0", className)} {...props} />
  ),
);
CardContent.displayName = "CardContent";

const CardFooter = forwardRef<React.ElementRef<typeof View>, ViewProps>(
  ({ className, ...props }, ref) => (
    <View ref={ref} className={cn("flex flex-row items-center p-6 pt-0", className)} {...props} />
  ),
);
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
