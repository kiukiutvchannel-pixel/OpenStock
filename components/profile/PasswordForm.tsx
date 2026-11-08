'use client';

import { useForm } from "react-hook-form";
import { toast } from "sonner";
import InputField from "@/components/forms/InputField";
import PasswordRequirements from "@/components/forms/PasswordRequirements";
import { PASSWORD_VALIDATION } from "@/lib/constants";
import { changePassword } from "@/lib/actions/profile.actions";
import { zh } from "@/lib/i18n/zh-Hant";

type PasswordInput = { currentPassword: string; newPassword: string };

export default function PasswordForm() {
    const { register, handleSubmit, watch, reset, formState: { errors, isSubmitting } } = useForm<PasswordInput>({
        defaultValues: { currentPassword: '', newPassword: '' },
        mode: 'onBlur',
    });

    const onSubmit = async (values: PasswordInput) => {
        const result = await changePassword(values);
        if (!result.success) {
            toast.error(zh.auth.profilePasswordFailed, { description: result.error });
            return;
        }
        toast.success(zh.auth.profilePasswordChanged, { description: zh.auth.profilePasswordChangedSub });
        reset();
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 p-4">
            <InputField
                name="currentPassword"
                label={zh.auth.profileCurrentPassword}
                placeholder={zh.auth.profileCurrentPasswordPh}
                type="password"
                register={register}
                error={errors.currentPassword}
                validation={{ required: zh.auth.profileCurrentPasswordRequired }}
            />
            <div className="flex flex-col gap-2">
                <InputField
                    name="newPassword"
                    label={zh.auth.newPassword}
                    placeholder={zh.auth.passwordHint}
                    type="password"
                    register={register}
                    error={errors.newPassword}
                    validation={PASSWORD_VALIDATION}
                />
                <PasswordRequirements password={watch('newPassword') ?? ''} />
            </div>
            <button type="submit" disabled={isSubmitting} className="btn btn-ghost self-start">
                {isSubmitting ? zh.auth.profileChanging : zh.auth.profileChange}
            </button>
        </form>
    );
}
