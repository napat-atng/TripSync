import { forwardRef } from "react";
import { TextInput, View, type TextInputProps } from "react-native";
import { cn } from "../../lib/utils";
import { AppText } from "../AppText";

export interface InputProps extends TextInputProps {
  className?: string;
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

const Input = forwardRef<React.ElementRef<typeof TextInput>, InputProps>(
  ({ className, label, error, icon, ...props }, ref) => {
    return (
      <View className="flex flex-col gap-1.5 mb-4">
        {label && (
          <AppText className="text-sm font-medium text-surface-700 ml-1">
            {label}
          </AppText>
        )}
        <View className="relative justify-center">
          {icon && (
            <View className="absolute left-4 z-10">
              {icon}
            </View>
          )}
          <TextInput
            ref={ref}
            className={cn(
              "flex h-14 w-full rounded-xl border border-surface-200 bg-surface-50 px-4 text-base text-surface-900",
              "focus:border-primary-500 focus:bg-white",
              icon && "pl-12",
              error && "border-red-500 focus:border-red-500",
              className,
            )}
            placeholderTextColor="#94a3b8"
            style={{ fontFamily: "Sarabun_400Regular" }}
            {...props}
          />
        </View>
        {error && (
          <AppText className="text-sm text-red-500 ml-1 mt-1">
            {error}
          </AppText>
        )}
      </View>
    );
  },
);

Input.displayName = "Input";

export { Input };
