'use client';

import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';

import FooterLink from '@/components/forms/FooterLink';
import InputField from '@/components/forms/InputField';
import PasswordRequirements from '@/components/forms/PasswordRequirements';
import OpenDevSocietyBranding from '@/components/OpenDevSocietyBranding';
import { Button } from '@/components/ui/button';
import { resetPasswordWithToken } from '@/lib/actions/auth.actions';
import { PASSWORD_VALIDATION } from '@/lib/constants';
import { zh } from '@/lib/i18n/zh-Hant';

type ResetPasswordFormData = {
    newPassword: string;
    confirmPassword: string;
};

const ResetPasswordForm = () => {
    const router = useRouter();
    const searchParams = useSearchParams();
    const token = searchParams.get('token') ?? '';
    const error = searchParams.get('error');

    const {
        register,
        watch,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm<ResetPasswordFormData>({
        defaultValues: {
            newPassword: '',
            confirmPassword: '',
        },
        mode: 'onBlur',
    });

    const newPassword = watch('newPassword');

    useEffect(() => {
        if (error === 'INVALID_TOKEN') {
            toast.error(zh.auth.resetInvalid);
        }
    }, [error]);

    const onSubmit = async (data: ResetPasswordFormData) => {
        if (!token) {
            toast.error(zh.auth.resetInvalid);
            return;
        }

        try {
            const result = await resetPasswordWithToken({
                token,
                newPassword: data.newPassword,
            });

            if (result.success) {
                toast.success(zh.auth.passwordUpdated);
                router.push('/sign-in');
                return;
            }

            toast.error(zh.auth.resetFailed, {
                description: result.error ?? zh.auth.resetUnable,
            });
        } catch (error) {
            toast.error(zh.auth.resetFailed, {
                description: error instanceof Error ? error.message : zh.auth.resetUnable,
            });
        }
    };

    return (
        <>
            <h1 className="form-title">{zh.auth.newPasswordTitle}</h1>
            <p className="text-sm text-gray-400 mb-6">{zh.auth.newPasswordSub}</p>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                <InputField
                    name="newPassword"
                    label={zh.auth.newPassword}
                    placeholder={zh.auth.passwordHint}
                    type="password"
                    register={register}
                    error={errors.newPassword}
                    validation={PASSWORD_VALIDATION}
                />
                <PasswordRequirements password={newPassword ?? ''} />

                <InputField
                    name="confirmPassword"
                    label={zh.auth.confirmPassword}
                    placeholder={zh.auth.confirmPassword}
                    type="password"
                    register={register}
                    error={errors.confirmPassword}
                    validation={{
                        required: zh.auth.confirmPassword,
                        validate: (value: string) =>
                            value === newPassword || zh.auth.confirmMismatch,
                    }}
                />

                <Button type="submit" disabled={isSubmitting} className="yellow-btn w-full mt-5">
                    {isSubmitting ? zh.auth.updatingPassword : zh.auth.updatePassword}
                </Button>

                <FooterLink text={zh.auth.resetUnavailable} linkText={zh.auth.sendReset} href="/forgot-password" />
                <OpenDevSocietyBranding outerClassName="mt-10 flex justify-center" />
            </form>
        </>
    );
};

export default ResetPasswordForm;
