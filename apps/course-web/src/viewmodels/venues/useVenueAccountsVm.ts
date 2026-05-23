import { useEffect, useMemo, useState } from "react";
import type { ConsoleUser, NoticeFn } from "../../pages/venues/types.ts";
import { bindUserToVenue, createConsoleUser, fetchAllUsers, fetchUnboundUsers, unbindUser } from "../../pages/venues/api.ts";

export function useVenueAccountsVm({
  authHeader,
  onNotice,
  activeVenueId,
  setLoading,
  onAfterChange
}: {
  authHeader: string;
  onNotice: NoticeFn;
  activeVenueId: string;
  setLoading: (value: string) => void;
  onAfterChange: () => Promise<void>;
}) {
  const [allUsers, setAllUsers] = useState<ConsoleUser[]>([]);
  const [accountsQuery, setAccountsQuery] = useState("");

  const [createAccountOpen, setCreateAccountOpen] = useState(false);
  const [accountUsername, setAccountUsername] = useState("");
  const [accountPassword, setAccountPassword] = useState("");

  const [bindAccountOpen, setBindAccountOpen] = useState(false);
  const [bindQuery, setBindQuery] = useState("");
  const [bindCandidates, setBindCandidates] = useState<ConsoleUser[]>([]);
  const [bindSelectedUserId, setBindSelectedUserId] = useState<number | null>(null);

  const filteredAccounts = useMemo(() => {
    const query = accountsQuery.trim();
    if (!query) return allUsers;
    return allUsers.filter((user) => String(user.username || "").includes(query));
  }, [accountsQuery, allUsers]);

  async function reloadUsers(signal?: AbortSignal) {
    const users = await fetchAllUsers(authHeader, signal);
    setAllUsers(users);
    return users;
  }

  useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    reloadUsers(controller.signal).catch((error) => {
      if (!alive) return;
      onNotice(error instanceof Error ? error.message : "加载账号失败。", "error");
    });
    return () => {
      alive = false;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authHeader]);

  async function loadBindCandidates(query: string) {
    try {
      setBindCandidates(await fetchUnboundUsers(authHeader, query));
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "加载账号失败。", "error");
    }
  }

  async function handleCreateAccount() {
    if (!accountUsername.trim() || !accountPassword.trim()) {
      onNotice("请填写账号和密码。", "error");
      return;
    }
    setLoading("正在创建账号...");
    try {
      const user = await createConsoleUser(authHeader, accountUsername.trim(), accountPassword.trim());
      setAllUsers((current) => [user, ...current]);
      setCreateAccountOpen(false);
      setAccountUsername("");
      setAccountPassword("");
      onNotice("账号已创建。");
      if (activeVenueId) {
        setBindAccountOpen(true);
        setBindQuery(user.username || "");
        setBindSelectedUserId(Number(user.id));
        await loadBindCandidates(user.username || "");
      }
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "创建账号失败。", "error");
    } finally {
      setLoading("");
    }
  }

  async function handleBindAccount() {
    if (!activeVenueId) return;
    if (!bindSelectedUserId) {
      onNotice("请选择要绑定的账号。", "error");
      return;
    }
    setLoading("正在绑定账号...");
    try {
      await bindUserToVenue(authHeader, activeVenueId, bindSelectedUserId);
      await reloadUsers();
      await onAfterChange();
      setBindAccountOpen(false);
      setBindQuery("");
      setBindCandidates([]);
      setBindSelectedUserId(null);
      onNotice("账号已绑定。");
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "绑定账号失败。", "error");
    } finally {
      setLoading("");
    }
  }

  async function handleUnbindAccount(userId: number) {
    if (!window.confirm("确认解绑该账号吗？解绑后该账号将无法登录，除非重新绑定到某个场馆。")) return;
    setLoading("正在解绑账号...");
    try {
      await unbindUser(authHeader, userId);
      await reloadUsers();
      await onAfterChange();
      onNotice("账号已解绑。");
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "解绑账号失败。", "error");
    } finally {
      setLoading("");
    }
  }

  function closeBindModal() {
    setBindAccountOpen(false);
    setBindQuery("");
    setBindCandidates([]);
    setBindSelectedUserId(null);
  }

  return {
    allUsers,
    reloadUsers,
    accountsQuery,
    setAccountsQuery,
    filteredAccounts,
    createAccountOpen,
    setCreateAccountOpen,
    accountUsername,
    setAccountUsername,
    accountPassword,
    setAccountPassword,
    handleCreateAccount,
    bindAccountOpen,
    setBindAccountOpen,
    bindQuery,
    setBindQuery,
    bindCandidates,
    bindSelectedUserId,
    setBindSelectedUserId,
    loadBindCandidates,
    handleBindAccount,
    closeBindModal,
    handleUnbindAccount
  };
}
