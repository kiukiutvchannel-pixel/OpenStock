'use client';

import React from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import InputField from '@/components/forms/InputField';
import FooterLink from '@/components/forms/FooterLink';
import OpenDevSocietyBranding from '@/components/OpenDevSocietyBranding';
import { requestPasswordResetEmail } from '@/lib/actions/auth.actions';
import { zh } from '@/lib/i18n/zh-Hant';

type ForgotPasswordFormData = {
    email: string;
};

const ForgotPasswordPage = () => {
    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm<ForgotPasswordFormData>({
        defaultValues: {
            email: '',
        },
        mode: 'onBlur',
    });

    const onSubmit = async (data: ForgotPasswordFormData) => {
        try {
            const result = await requestPasswordResetEmail(data);

            if (result.success) {
                toast.success(zh.auth.resetSent);
                return;
            }

            toast.error(zh.auth.resetUnavailable, {
                description: result.error ?? zh.auth.resetStartFailed,
            });
        } catch (error) {
            toast.error(zh.auth.resetUnavailable, {
                description: error instanceof Error ? error.message : zh.auth.resetStartFailed,
            });
        }
    };

    return (
        <>
            <h1 className="form-title">{zh.auth.forgotTitle}</h1>
            <p className="text-sm text-gray-400 mb-6">{zh.auth.forgotSub}</p>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                <InputField
                    name="email"
                    label={zh.auth.email}
                    placeholder="you@example.com"
                    register={register}
                    error={errors.email}
                    validation={{
                        required: zh.auth.emailRequired,
                        pattern: {
                            value: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/,
                            message: zh.auth.emailInvalid,
                        },
                    }}
                />

                <Button type="submit" disabled={isSubmitting} className="yellow-btn w-full mt-5">
                    {isSubmitting ? zh.auth.sendingReset : zh.auth.sendReset}
                </Button>

                <FooterLink text={zh.auth.remembered} linkText={zh.auth.signIn} href="/sign-in" />
                <OpenDevSocietyBranding outerClassName="mt-10 flex justify-center" />
            </form>
        </>
    );
};

export default ForgotPasswordPage;
