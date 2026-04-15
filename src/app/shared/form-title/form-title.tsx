import React from 'react';

type FormTitleSize = 'xs' | 'sm' | 'md';

interface FormTitleBaseProps {
  children: React.ReactNode;
  size?: FormTitleSize;
}

interface FormTitleLabelProps extends FormTitleBaseProps {
  as?: 'label';
  htmlFor: string;
}

interface FormTitleSpanProps extends FormTitleBaseProps {
  as: 'span';
  htmlFor?: never;
}

type FormTitleProps = FormTitleLabelProps | FormTitleSpanProps;

const sizeClasses: Record<FormTitleSize, string> = {
  xs: 'text-xs tracking-wider',
  sm: 'text-sm',
  md: 'text-base',
};

export function FormTitle({
  children,
  as = 'label',
  size = 'sm',
  htmlFor,
}: FormTitleProps) {
  const className = `font-medium uppercase tracking-wide cursor-default text-slate-500 dark:text-slate-300 ${sizeClasses[size]}`;
  const Element = as;

  return (
    <Element className={className} htmlFor={htmlFor}>
      {children}
    </Element>
  );
}
