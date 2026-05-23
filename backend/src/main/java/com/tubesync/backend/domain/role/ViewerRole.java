package com.tubesync.backend.domain.role;

import com.tubesync.backend.enums.RoleType;

public class ViewerRole implements Role {

    @Override public boolean canControlPlayback() { return false; }
    @Override public boolean canManageRoles()     { return false; }
    @Override public boolean canKick()            { return false; }
    @Override public boolean canChat()            { return false; }
    @Override public RoleType getRoleType()       { return RoleType.VIEWER; }
}
