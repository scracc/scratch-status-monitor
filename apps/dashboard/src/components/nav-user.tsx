"use client";

import { ChevronsUpDown, LogOut, User } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  clearConnectionConfig,
  getActiveConnectionUserId,
  loadConnectionUsers,
  onConnectionConfigChanged,
  removeConnectionUser,
  setActiveConnectionUser,
} from "@/lib/connection-config";

export function NavUser() {
  const { isMobile } = useSidebar();

  const [users, setUsers] = useState(() => loadConnectionUsers());
  const [activeUserId, setActiveUserId] = useState(() => getActiveConnectionUserId());

  const refreshUsers = useCallback(() => {
    setUsers(loadConnectionUsers());
    setActiveUserId(getActiveConnectionUserId());
  }, []);

  useEffect(() => {
    refreshUsers();
    return onConnectionConfigChanged(refreshUsers);
  }, [refreshUsers]);

  const activeUser = useMemo(
    () => users.find((user) => user.id === activeUserId) ?? users[0] ?? null,
    [activeUserId, users]
  );

  const fallbackUser = useMemo(
    () => ({
      id: "none",
      name: "未接続",
      email: "接続を設定してください",
      avatar: "",
      baseUrl: "",
    }),
    []
  );

  const displayedUser = activeUser ?? fallbackUser;

  const handleSwitchUser = useCallback((userId: string) => {
    setActiveConnectionUser(userId);
  }, []);

  const handleDeleteCurrentUser = useCallback(() => {
    if (!activeUser) {
      return;
    }

    if (!window.confirm(`接続ユーザー「${activeUser.name}」を削除しますか？`)) {
      return;
    }

    removeConnectionUser(activeUser.id);
  }, [activeUser]);

  const handleClearAll = useCallback(() => {
    if (!window.confirm("現在のアクティブ接続を削除しますか？")) {
      return;
    }

    clearConnectionConfig();
  }, []);

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              >
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarImage src={displayedUser.avatar} alt={displayedUser.name} />
                  <AvatarFallback className="rounded-lg">SS</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{displayedUser.name}</span>
                  <span className="truncate text-xs">{displayedUser.email}</span>
                </div>
                <ChevronsUpDown className="ml-auto size-4" />
              </SidebarMenuButton>
            }
          />
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                  <Avatar className="h-8 w-8 rounded-lg">
                    <AvatarImage src={displayedUser.avatar} alt={displayedUser.name} />
                    <AvatarFallback className="rounded-lg">SS</AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">{displayedUser.name}</span>
                    <span className="truncate text-xs">{displayedUser.email}</span>
                  </div>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel>接続ユーザー切替</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={activeUser?.id ?? ""} onValueChange={handleSwitchUser}>
                {users.map((user) => (
                  <DropdownMenuRadioItem key={user.id} value={user.id}>
                    <User />
                    <div className="grid">
                      <span className="truncate">{user.name}</span>
                      <span className="truncate text-xs text-muted-foreground">{user.baseUrl}</span>
                    </div>
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem
                onClick={handleDeleteCurrentUser}
                disabled={!activeUser}
                variant="destructive"
              >
                <LogOut />
                現在の接続ユーザーを削除
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleClearAll} variant="destructive" disabled={!activeUser}>
              <LogOut />
              アクティブ接続をクリア
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
