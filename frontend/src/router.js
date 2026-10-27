import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// The booking and payment screens navigate with a plain function,
// navigate('/pnr/1000000016'). The app runs on react-router (Team 1's
// routing, see App.jsx); <RouterBridge /> hands its navigate to this module.

let routerNavigate = null;

export function RouterBridge() {
  const nav = useNavigate();
  useEffect(() => {
    routerNavigate = nav;
    return () => {
      routerNavigate = null;
    };
  }, [nav]);
  return null;
}

export const navigate = (path) => {
  const to = path.startsWith('/') ? path : `/${path}`;
  if (routerNavigate) routerNavigate(to);
  else window.location.assign(to);
};
